#!/usr/bin/env python3
"""
HTTP image job API backed by Codex CLI.

Stable JSON job endpoints:
  GET  /health
  GET  /debug
  GET  /v1/jobs/{jobId}
  POST /v1/jobs/text
       JSON: {"prompt": "description", "jobId": "optional id"}
  POST /v1/jobs/reference
       multipart/form-data:
         prompt: description
         jobId: optional id
         image: one or more reference images

Legacy compatibility endpoints:
  POST /v1/images/text
  POST /v1/images/reference

The JSON job endpoints always keep the job directory and write metadata.json.
Success is determined by a valid output image, not only by Codex's exit code.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import signal
import shlex
import shutil
import subprocess
import time
import uuid
from email.message import EmailMessage
from email.parser import BytesParser
from email.policy import default
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from string import Template
from typing import Any
from urllib.parse import unquote, urlparse


SERVICE_VERSION = "CodexImageAPI/3.0"
BASE_DIR = Path(os.environ.get("CODEX_IMAGE_API_WORKDIR", "/data/codex_image_api_runs"))
CODEX_BIN = os.environ.get("CODEX_BIN", "codex")
CODEX_MODEL = os.environ.get("CODEX_MODEL", "")
CODEX_TIMEOUT_SECONDS = int(os.environ.get("CODEX_TIMEOUT_SECONDS", "1800"))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
KEEP_SUCCESS_JOBS = os.environ.get("CODEX_IMAGE_API_KEEP_SUCCESS_JOBS", "1") != "0"
KEEP_FAILED_JOBS = os.environ.get("CODEX_IMAGE_API_KEEP_FAILED_JOBS", "1") != "0"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
OUTPUT_FILENAMES_TO_IGNORE = {
    "prompt.txt",
    "command.txt",
    "stdout.txt",
    "stderr.txt",
    "metadata.json",
}

UploadedReference = tuple[bytes, str | None]


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, error_code: str, message: str, job: dict[str, Any] | None = None):
        super().__init__(message)
        self.status = status
        self.error_code = error_code
        self.message = message
        self.job = job


def json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def tail_text(value: str | None, limit: int = 2000) -> str:
    return (value or "")[-limit:]


def safe_job_id(value: str | None) -> str:
    cleaned = "".join(ch for ch in (value or "") if ch.isalnum() or ch in {"_", "-"})
    return cleaned[:120] or uuid.uuid4().hex


def safe_suffix(filename: str | None, fallback: str = ".png") -> str:
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix in IMAGE_EXTENSIONS else fallback


def job_dir_for(job_id: str) -> Path:
    return BASE_DIR / "tasks" / safe_job_id(job_id)


def image_looks_valid(path: Path) -> bool:
    try:
        header = path.read_bytes()[:16]
        size = path.stat().st_size
    except OSError:
        return False
    if size <= 0:
        return False
    return (
        header.startswith(b"\x89PNG\r\n\x1a\n")
        or header.startswith(b"\xff\xd8\xff")
        or (header.startswith(b"RIFF") and b"WEBP" in header)
        or header.startswith(b"GIF87a")
        or header.startswith(b"GIF89a")
    )


def output_candidate_allowed(path: Path) -> bool:
    name = path.name.lower()
    if name in OUTPUT_FILENAMES_TO_IGNORE:
        return False
    if name.startswith("reference_") or name.startswith("input."):
        return False
    return path.suffix.lower() in IMAGE_EXTENSIONS


def latest_valid_image(root: Path, started_at: float) -> Path | None:
    candidates: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or not output_candidate_allowed(path):
            continue
        try:
            if path.stat().st_mtime >= started_at and image_looks_valid(path):
                candidates.append(path)
        except OSError:
            continue
    return max(candidates, key=lambda item: item.stat().st_mtime) if candidates else None


def ensure_result_png(job_dir: Path, started_at: float) -> Path | None:
    result_path = job_dir / "result.png"
    try:
        if result_path.exists() and result_path.stat().st_mtime >= started_at and image_looks_valid(result_path):
            return result_path
    except OSError:
        pass

    candidate = latest_valid_image(job_dir, started_at)
    if candidate is None:
        return None

    if candidate != result_path:
        shutil.copyfile(candidate, result_path)
    return result_path if image_looks_valid(result_path) else None


def file_size(path: Path | None) -> int | None:
    if path is None:
        return None
    try:
        return path.stat().st_size
    except OSError:
        return None


def reference_file_payload(path: Path, filename: str | None) -> dict[str, Any]:
    return {
        "path": str(path),
        "fileSize": file_size(path) or 0,
        "filename": filename or path.name,
    }


def write_text_file(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def write_metadata(job_dir: Path, payload: dict[str, Any]) -> Path:
    metadata_path = job_dir / "metadata.json"
    payload["metadataPath"] = str(metadata_path)
    metadata_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata_path


def codex_prompt(user_prompt: str, output_path: Path) -> str:
    return f"""{user_prompt}

Save the final image result exactly at: {output_path}
"""


def build_default_command(prompt_file: Path, output_path: Path, reference_paths: list[Path]) -> tuple[list[str], str | None]:
    prompt = prompt_file.read_text(encoding="utf-8")
    command = [
        CODEX_BIN,
        "exec",
        "--cd",
        str(output_path.parent),
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "--ephemeral",
    ]
    if CODEX_MODEL:
        command.extend(["--model", CODEX_MODEL])
    for reference_path in reference_paths:
        command.extend(["--image", str(reference_path)])
    command.extend(["--", "-"])
    return command, prompt


def build_command(prompt_file: Path, output_path: Path, reference_paths: list[Path]) -> tuple[list[str], str | None]:
    template = os.environ.get("CODEX_IMAGE_COMMAND", "").strip()
    if not template:
        return build_default_command(prompt_file, output_path, reference_paths)

    rendered = Template(template).safe_substitute(
        prompt_file=str(prompt_file),
        output_path=str(output_path),
        workdir=str(output_path.parent),
        reference_path=str(reference_paths[0]) if reference_paths else "",
        reference_paths=" ".join(shlex.quote(str(path)) for path in reference_paths),
        codex_bin=CODEX_BIN,
    )
    return shlex.split(rendered), None


def terminate_process_group(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            return
        process.wait(timeout=10)


def run_job(user_prompt: str, references: list[UploadedReference] | None = None, job_id: str | None = None) -> dict[str, Any]:
    job_id = safe_job_id(job_id)
    job_dir = job_dir_for(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)
    output_path = job_dir / "result.png"
    started_at = time.time()
    started_iso = now_iso()
    stdout = ""
    stderr = ""
    return_code: int | None = None
    command: list[str] = []
    reference_payloads: list[dict[str, Any]] = []

    def payload(
        *,
        ok: bool,
        status: str,
        error_code: str | None = None,
        message: str | None = None,
        result_path: Path | None = None,
    ) -> dict[str, Any]:
        finished_at = now_iso()
        data: dict[str, Any] = {
            "ok": ok,
            "jobId": job_id,
            "status": status,
            "startedAt": started_iso,
            "finishedAt": finished_at,
            "durationMs": int((time.time() - started_at) * 1000),
            "prompt": user_prompt,
            "jobDir": str(job_dir),
            "referenceFiles": reference_payloads,
            "resultPath": str(result_path) if result_path else None,
            "resultFileSize": file_size(result_path),
            "returnCode": return_code,
            "errorCode": error_code,
            "message": message,
            "stdoutTail": tail_text(stdout),
            "stderrTail": tail_text(stderr),
            "command": shlex.join(command) if command else "",
        }
        metadata_path = write_metadata(job_dir, data)
        data["metadataPath"] = str(metadata_path)
        return data

    try:
        prompt_text = user_prompt.strip()
        if not prompt_text:
            return payload(ok=False, status="failed", error_code="INVALID_INPUT", message="Field 'prompt' must not be empty.")

        codex_path = shutil.which(CODEX_BIN)
        if codex_path is None:
            return payload(ok=False, status="failed", error_code="CODEX_NOT_FOUND", message=f"Codex CLI not found: {CODEX_BIN}")

        reference_paths: list[Path] = []
        for index, (content, filename) in enumerate(references or [], start=1):
            if not content:
                return payload(ok=False, status="failed", error_code="INVALID_INPUT", message="Uploaded image must not be empty.")
            reference_path = job_dir / f"reference_{index:02d}{safe_suffix(filename)}"
            reference_path.write_bytes(content)
            reference_paths.append(reference_path)
            reference_payloads.append(reference_file_payload(reference_path, filename))

        prompt_file = job_dir / "prompt.txt"
        write_text_file(prompt_file, codex_prompt(prompt_text, output_path))
        command, stdin_text = build_command(prompt_file, output_path, reference_paths)
        write_text_file(job_dir / "command.txt", shlex.join(command))

        print(f"[job] start jobId={job_id} jobDir={job_dir}", flush=True)
        for ref in reference_payloads:
            print(f"[job] reference jobId={job_id} path={ref['path']} size={ref['fileSize']}", flush=True)
        print(f"[job] command jobId={job_id} {shlex.join(command)}", flush=True)

        process: subprocess.Popen[str] | None = None
        try:
            process = subprocess.Popen(
                command,
                cwd=job_dir,
                text=True,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                start_new_session=True,
            )
            stdout, stderr = process.communicate(input=stdin_text, timeout=CODEX_TIMEOUT_SECONDS)
            return_code = process.returncode
        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout if isinstance(exc.stdout, str) else (exc.stdout or b"").decode("utf-8", errors="replace")
            stderr = exc.stderr if isinstance(exc.stderr, str) else (exc.stderr or b"").decode("utf-8", errors="replace")
            if process is not None:
                terminate_process_group(process)
                return_code = process.returncode
            write_text_file(job_dir / "stdout.txt", stdout)
            write_text_file(job_dir / "stderr.txt", stderr)

            result_path = ensure_result_png(job_dir, started_at)
            if result_path:
                data = payload(ok=True, status="succeeded", result_path=result_path, message="Codex timed out but a valid output image was found.")
                print(f"[job] succeeded_after_timeout jobId={job_id} resultPath={result_path} size={file_size(result_path)}", flush=True)
                return data

            data = payload(
                ok=False,
                status="failed",
                error_code="CODEX_TIMEOUT",
                message=f"Codex timed out after {CODEX_TIMEOUT_SECONDS}s.",
            )
            print(f"[job] failed jobId={job_id} errorCode=CODEX_TIMEOUT", flush=True)
            return data
        except OSError as exc:
            data = payload(ok=False, status="failed", error_code="INTERNAL_ERROR", message=f"Failed to run Codex: {exc}")
            print(f"[job] failed jobId={job_id} errorCode=INTERNAL_ERROR message={exc}", flush=True)
            return data
        finally:
            if process is not None:
                terminate_process_group(process)

        write_text_file(job_dir / "stdout.txt", stdout)
        write_text_file(job_dir / "stderr.txt", stderr)

        result_path = ensure_result_png(job_dir, started_at)
        if result_path:
            data = payload(ok=True, status="succeeded", result_path=result_path)
            print(
                f"[job] succeeded jobId={job_id} returnCode={return_code} resultPath={result_path} size={file_size(result_path)}",
                flush=True,
            )
            return data

        if return_code not in (0, None):
            data = payload(
                ok=False,
                status="failed",
                error_code="CODEX_FAILED",
                message=f"Codex failed with exit code {return_code}.",
            )
            print(f"[job] failed jobId={job_id} returnCode={return_code} errorCode=CODEX_FAILED", flush=True)
            return data

        if output_path.exists() and not image_looks_valid(output_path):
            data = payload(ok=False, status="failed", error_code="INVALID_OUTPUT_IMAGE", message="Generated output image is invalid.")
            print(f"[job] failed jobId={job_id} errorCode=INVALID_OUTPUT_IMAGE", flush=True)
            return data

        data = payload(ok=False, status="failed", error_code="NO_OUTPUT_IMAGE", message="Codex completed but no valid output image was found.")
        print(f"[job] failed jobId={job_id} errorCode=NO_OUTPUT_IMAGE", flush=True)
        return data
    except Exception as exc:
        data = payload(ok=False, status="failed", error_code="INTERNAL_ERROR", message=str(exc))
        print(f"[job] failed jobId={job_id} errorCode=INTERNAL_ERROR message={exc}", flush=True)
        return data


def refresh_job_metadata(job_id: str) -> dict[str, Any] | None:
    job_id = safe_job_id(job_id)
    job_dir = job_dir_for(job_id)
    metadata_path = job_dir / "metadata.json"
    metadata: dict[str, Any] = {}

    if metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            metadata = {}
    elif not job_dir.exists():
        return None

    started_raw = metadata.get("startedAt")
    started_at = 0.0
    if isinstance(started_raw, str) and metadata_path.exists():
        try:
            started_at = metadata_path.stat().st_mtime - 10
        except OSError:
            started_at = 0.0

    result_path = ensure_result_png(job_dir, started_at)
    if result_path:
        metadata.update(
            {
                "ok": True,
                "jobId": job_id,
                "status": "succeeded",
                "jobDir": str(job_dir),
                "resultPath": str(result_path),
                "resultFileSize": file_size(result_path),
                "errorCode": None,
                "message": metadata.get("message"),
            }
        )
        write_metadata(job_dir, metadata)
    elif metadata:
        metadata.setdefault("ok", metadata.get("status") == "succeeded")
        metadata.setdefault("jobId", job_id)
        metadata.setdefault("jobDir", str(job_dir))
        metadata.setdefault("metadataPath", str(metadata_path))
    else:
        metadata = {
            "ok": True,
            "jobId": job_id,
            "status": "processing",
            "errorCode": None,
            "message": "Job is still processing.",
            "jobDir": str(job_dir),
            "metadataPath": str(metadata_path),
            "resultPath": None,
            "resultFileSize": None,
        }
        write_metadata(job_dir, metadata)

    return metadata


def multipart_text(part: EmailMessage) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        content = part.get_content()
        return content if isinstance(content, str) else str(content)
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset)
    except UnicodeDecodeError:
        return payload.decode("utf-8", errors="replace")


def debug_payload() -> dict[str, Any]:
    codex_path = shutil.which(CODEX_BIN)
    return {
        "ok": True,
        "version": SERVICE_VERSION,
        "mode": "json-job-api",
        "codexBin": CODEX_BIN,
        "codexPath": codex_path,
        "codexAvailable": codex_path is not None,
        "codexModel": CODEX_MODEL or None,
        "timeoutSeconds": CODEX_TIMEOUT_SECONDS,
        "maxUploadBytes": MAX_UPLOAD_BYTES,
        "baseDir": str(BASE_DIR),
        "baseDirExists": BASE_DIR.exists(),
        "keepSuccessJobs": KEEP_SUCCESS_JOBS,
        "keepFailedJobs": KEEP_FAILED_JOBS,
        "customCommandEnabled": bool(os.environ.get("CODEX_IMAGE_COMMAND", "").strip()),
        "supportedEndpoints": [
            "GET /health",
            "GET /debug",
            "GET /v1/jobs/{jobId}",
            "POST /v1/jobs/text",
            "POST /v1/jobs/reference",
            "POST /v1/images/text",
            "POST /v1/images/reference",
        ],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = SERVICE_VERSION

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in {"/", "/health"}:
            self.safe_send_json(HTTPStatus.OK, {"ok": True, "version": SERVICE_VERSION})
            return
        if path == "/debug":
            self.safe_send_json(HTTPStatus.OK, debug_payload())
            return
        if path.startswith("/v1/jobs/"):
            job_id = unquote(path.removeprefix("/v1/jobs/")).strip("/")
            payload = refresh_job_metadata(job_id)
            if payload is None:
                self.safe_send_json(
                    HTTPStatus.NOT_FOUND,
                    {"ok": False, "status": "failed", "errorCode": "JOB_NOT_FOUND", "message": "Job not found."},
                )
                return
            self.safe_send_json(HTTPStatus.OK, payload)
            return
        self.safe_send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        try:
            path = urlparse(self.path).path
            if path == "/v1/jobs/text":
                prompt, job_id = self.read_json_job_prompt()
                self.safe_send_json(HTTPStatus.OK, run_job(prompt, job_id=job_id))
                return
            if path == "/v1/jobs/reference":
                prompt, references, job_id = self.read_multipart_job_reference()
                self.safe_send_json(HTTPStatus.OK, run_job(prompt, references, job_id=job_id))
                return
            if path == "/v1/images/text":
                prompt = self.read_json_prompt()
                job_id = self.headers.get("X-AI-Task-Id")
                payload = run_job(prompt, job_id=job_id)
                self.send_legacy_image_or_error(payload)
                return
            if path == "/v1/images/reference":
                prompt, references, job_id = self.read_multipart_job_reference()
                job_id = job_id or self.headers.get("X-AI-Task-Id")
                payload = run_job(prompt, references, job_id=job_id)
                self.send_legacy_image_or_error(payload)
                return
            self.safe_send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found"})
        except ApiError as exc:
            payload = exc.job or {"ok": False, "status": "failed", "errorCode": exc.error_code, "message": exc.message}
            self.safe_send_json(exc.status, payload)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:
            self.safe_send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ok": False, "status": "failed", "errorCode": "INTERNAL_ERROR", "message": str(exc)},
            )

    def read_body(self) -> bytes:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "Invalid Content-Length.") from exc
        if length <= 0:
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "Request body is required.")
        if length > MAX_UPLOAD_BYTES:
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "INVALID_INPUT", "Request body is too large.")
        return self.rfile.read(length)

    def read_json_payload(self) -> dict[str, Any]:
        content_type = self.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            raise ApiError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "INVALID_INPUT", "Use application/json.")
        try:
            payload = json.loads(self.read_body().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "Invalid JSON body.") from exc
        if not isinstance(payload, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "JSON body must be an object.")
        return payload

    def read_json_prompt(self) -> str:
        payload = self.read_json_payload()
        prompt = payload.get("prompt")
        if not isinstance(prompt, str):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "JSON field 'prompt' must be a string.")
        return prompt

    def read_json_job_prompt(self) -> tuple[str, str | None]:
        payload = self.read_json_payload()
        prompt = payload.get("prompt")
        if not isinstance(prompt, str):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "JSON field 'prompt' must be a string.")
        job_id = payload.get("jobId")
        return prompt, job_id if isinstance(job_id, str) else None

    def read_multipart_job_reference(self) -> tuple[str, list[UploadedReference], str | None]:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise ApiError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "INVALID_INPUT", "Use multipart/form-data.")

        message_bytes = (
            f"Content-Type: {content_type}\r\n"
            f"MIME-Version: 1.0\r\n\r\n"
        ).encode("utf-8") + self.read_body()
        message = BytesParser(policy=default).parsebytes(message_bytes)
        if not message.is_multipart():
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "Invalid multipart body.")

        prompt: str | None = None
        job_id: str | None = None
        references: list[UploadedReference] = []
        for part in message.iter_parts():
            if part.get_content_disposition() != "form-data":
                continue
            name = part.get_param("name", header="content-disposition")
            if name == "prompt":
                prompt = multipart_text(part)
            elif name == "jobId":
                job_id = multipart_text(part)
            elif name == "image":
                references.append((part.get_payload(decode=True) or b"", part.get_filename()))

        if not isinstance(prompt, str):
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "Multipart field 'prompt' is required.")
        if not references:
            raise ApiError(HTTPStatus.BAD_REQUEST, "INVALID_INPUT", "At least one multipart file field 'image' is required.")
        return prompt, references, job_id

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def safe_send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        try:
            self.send_json(status, payload)
        except (BrokenPipeError, ConnectionResetError):
            return

    def send_legacy_image_or_error(self, payload: dict[str, Any]) -> None:
        if not payload.get("ok"):
            status = HTTPStatus.BAD_GATEWAY
            if payload.get("errorCode") == "INVALID_INPUT":
                status = HTTPStatus.BAD_REQUEST
            elif payload.get("errorCode") == "CODEX_TIMEOUT":
                status = HTTPStatus.GATEWAY_TIMEOUT
            self.safe_send_json(status, payload)
            return

        result_path = Path(str(payload.get("resultPath") or ""))
        if not result_path.exists() or not image_looks_valid(result_path):
            self.safe_send_json(
                HTTPStatus.BAD_GATEWAY,
                {
                    **payload,
                    "ok": False,
                    "status": "failed",
                    "errorCode": "INVALID_OUTPUT_IMAGE",
                    "message": "Result image is missing or invalid.",
                },
            )
            return
        self.send_image(result_path)

    def send_image(self, image_path: Path) -> None:
        body = image_path.read_bytes()
        mime_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'inline; filename="{image_path.name}"')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"{self.address_string()} - {fmt % args}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="HTTP API for Codex CLI image generation jobs.")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    args = parser.parse_args()

    BASE_DIR.mkdir(parents=True, exist_ok=True)
    (BASE_DIR / "tasks").mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Serving on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
