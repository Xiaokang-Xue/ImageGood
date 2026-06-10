import "server-only";
import net from "net";
import tls from "tls";
import { Buffer } from "buffer";

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSendError";
  }
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface MailUser {
  email: string;
  name: string;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function smtpPort() {
  const port = Number(process.env.SMTP_PORT || "465");
  return Number.isFinite(port) && port > 0 ? port : 465;
}

function smtpSecure() {
  return String(process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
}

export function isEmailServiceConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

function extractEmailAddress(value: string) {
  const angleMatch = value.match(/<([^<>@\s]+@[^<>\s]+)>/);
  if (angleMatch?.[1]) return angleMatch[1];

  const mailtoMatch = value.match(/mailto:([^)\]\s]+@[^)\]\s]+)/i);
  if (mailtoMatch?.[1]) return mailtoMatch[1];

  const bracketMatch = value.match(/\[([^\]\s]+@[^\]\s]+)\]/);
  if (bracketMatch?.[1]) return bracketMatch[1];

  const plainMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainMatch?.[0] || value.trim();
}

function fromHeader() {
  const raw = process.env.SMTP_FROM || process.env.SMTP_USER || "ImageGood <noreply@example.com>";
  const email = extractEmailAddress(raw);

  if (raw.includes("<") && raw.includes(">")) {
    return { header: raw.replace(/\r|\n/g, ""), address: email };
  }

  const name = raw
    .replace(/\[.*?\]\(mailto:.*?\)/gi, "")
    .replace(email, "")
    .replace(/["<>]/g, "")
    .trim() || "ImageGood";

  return { header: `${name} <${email}>`, address: email };
}

function escapeHeader(value: string) {
  return value.replace(/\r|\n/g, " ").trim();
}

function escapeSmtpData(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildMessage(input: SendEmailInput) {
  const from = fromHeader();
  const boundary = `imagegood-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return [
    `From: ${from.header}`,
    `To: ${escapeHeader(input.to)}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

function readResponse(socket: net.Socket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new EmailSendError("SMTP 服务响应超时"));
    }, 20_000);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (/^\d{3}\s/.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(socket: net.Socket, command: string, expectedCodes: number[]) {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new EmailSendError(`SMTP 命令失败：${command.split(" ")[0]}，响应：${response.trim()}`);
  }
  return response;
}

function connectPlain(host: string, port: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => resolve(socket));
    socket.setTimeout(30_000, () => {
      socket.destroy(new EmailSendError("SMTP 连接超时"));
    });
    socket.once("error", reject);
  });
}

function connectTls(host: string, port: number) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
    socket.setTimeout(30_000, () => {
      socket.destroy(new EmailSendError("SMTP TLS 连接超时"));
    });
    socket.once("error", reject);
  });
}

function upgradeToTls(socket: net.Socket, host: string) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));
    secureSocket.once("error", reject);
  });
}

export async function sendEmail(input: SendEmailInput) {
  if (!isEmailServiceConfigured()) {
    const message = `邮件服务未配置完整，无法发送：${input.subject} -> ${input.to}\n${input.text}`;
    if (!isProduction()) {
      console.info(`[email] ${message}`);
      return { sent: false, devLogged: true };
    }
    throw new EmailSendError("邮件服务未配置完整，请联系管理员检查 SMTP 设置");
  }

  const host = process.env.SMTP_HOST as string;
  const port = smtpPort();
  const secure = smtpSecure();
  const from = fromHeader();
  let socket: net.Socket = secure ? await connectTls(host, port) : await connectPlain(host, port);

  try {
    await readResponse(socket);
    await sendCommand(socket, `EHLO ${host}`, [250]);

    if (!secure) {
      await sendCommand(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, host);
      await sendCommand(socket, `EHLO ${host}`, [250]);
    }

    await sendCommand(socket, "AUTH LOGIN", [334]);
    await sendCommand(socket, Buffer.from(process.env.SMTP_USER || "").toString("base64"), [334]);
    await sendCommand(socket, Buffer.from(process.env.SMTP_PASS || "").toString("base64"), [235]);
    await sendCommand(socket, `MAIL FROM:<${from.address}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${extractEmailAddress(input.to)}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    socket.write(`${escapeSmtpData(buildMessage(input))}\r\n.\r\n`);
    const dataResponse = await readResponse(socket);
    const dataCode = Number(dataResponse.slice(0, 3));
    if (![250].includes(dataCode)) {
      throw new EmailSendError(`SMTP 邮件发送失败：${dataResponse.trim()}`);
    }
    await sendCommand(socket, "QUIT", [221]).catch(() => null);
    return { sent: true, devLogged: false };
  } finally {
    socket.end();
  }
}

function baseEmailHtml(title: string, body: string, buttonText: string, url: string) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 12px;color:#111827;font-size:22px;">${title}</h1>
        <p style="margin:0 0 22px;color:#475569;line-height:1.7;">${body}</p>
        <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:700;">${buttonText}</a>
        <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.7;">如果按钮无法打开，请复制以下链接到浏览器：</p>
        <p style="word-break:break-all;color:#4f46e5;font-size:13px;">${url}</p>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">该链接 30 分钟内有效。如非本人操作，请忽略本邮件。</p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(user: MailUser, verifyUrl: string) {
  return sendEmail({
    to: user.email,
    subject: "请验证你的 ImageGood 账号邮箱",
    text: `你好，${user.name}。\n\n请打开以下链接完成 ImageGood 账号邮箱验证：\n${verifyUrl}\n\n该链接 30 分钟内有效。`,
    html: baseEmailHtml(
      "验证你的 ImageGood 账号邮箱",
      `你好，${user.name}。请点击下方按钮完成邮箱验证，验证后即可使用图片生成和购买积分功能。`,
      "验证邮箱",
      verifyUrl
    )
  });
}

export async function sendPasswordResetEmail(user: MailUser, resetUrl: string) {
  return sendEmail({
    to: user.email,
    subject: "重置你的 ImageGood 密码",
    text: `你好，${user.name}。\n\n请打开以下链接重置 ImageGood 登录密码：\n${resetUrl}\n\n该链接 30 分钟内有效。`,
    html: baseEmailHtml(
      "重置你的 ImageGood 密码",
      `你好，${user.name}。请点击下方按钮设置新的登录密码。`,
      "重置密码",
      resetUrl
    )
  });
}
