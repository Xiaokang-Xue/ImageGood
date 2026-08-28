import { NextRequest, NextResponse } from "next/server";
import { getImageTaskById, hasPaidOrderForUser } from "@/lib/db";
import { imageExtensionFromMimeType } from "@/lib/server/image-file";
import { getPrivateResultSignedUrl, readPrivateResultImage } from "@/lib/server/image-storage";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { status: "failed", error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 }
    );
  }

  const task = await getImageTaskById(params.id);
  if (!task || (task.userId !== user.id && user.role !== "admin")) {
    return NextResponse.json(
      { status: "failed", error: { code: "TASK_NOT_FOUND", message: "记录不存在或无权访问" } },
      { status: 404 }
    );
  }

  if (!task.isFreeTrial || !task.hasWatermark || !task.originalResultImages?.[0]) {
    return NextResponse.json(
      { status: "failed", error: { code: "ORIGINAL_RESULT_NOT_FOUND", message: "无水印结果不存在" } },
      { status: 404 }
    );
  }

  const unlocked = user.role === "admin" || Boolean(task.unlockedAt) || (await hasPaidOrderForUser(task.userId));
  if (!unlocked) {
    return NextResponse.json(
      {
        status: "failed",
        error: {
          code: "PAID_DOWNLOAD_REQUIRED",
          message: "免费体验结果带有水印，购买任一图片额度方案后可下载无水印图片",
          actionUrl: "/pricing"
        }
      },
      { status: 402 }
    );
  }

  try {
    const inline = request.nextUrl.searchParams.get("inline") === "1";
    const storedReference = task.originalResultImages[0];
    const referenceExtension = storedReference.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
    const provisionalFilename = `imagegood-${task.type}-${task.id}.${referenceExtension || "png"}`;
    const forceServerTransfer = request.nextUrl.searchParams.get("image_proxy") === "1";
    const signedUrl = forceServerTransfer
      ? null
      : await getPrivateResultSignedUrl(storedReference, {
          filename: provisionalFilename,
          inline
        });
    if (signedUrl) {
      const response = NextResponse.redirect(signedUrl, 307);
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Vary", "Cookie");
      return response;
    }

    const result = await readPrivateResultImage(storedReference);
    const extension = imageExtensionFromMimeType(result.mimeType);
    const filename = `imagegood-${task.type}-${task.id}.${extension}`;
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": String(result.buffer.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie"
      }
    });
  } catch (error) {
    console.error("[task-download] failed to read original result", {
      taskId: task.id,
      userId: task.userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { status: "failed", error: { code: "ORIGINAL_RESULT_UNAVAILABLE", message: "无水印图片暂时无法下载，请稍后重试" } },
      { status: 500 }
    );
  }
}
