import { createHmac } from "crypto";

interface FeishuResponse {
  code?: number;
  msg?: string;
  StatusCode?: number;
  StatusMessage?: string;
}

function createFeishuSign(timestamp: string, secret: string) {
  const stringToSign = `${timestamp}\n${secret}`;
  return createHmac("sha256", stringToSign).update("").digest("base64");
}

function redactedWebhook(webhook: string) {
  try {
    const url = new URL(webhook);
    const parts = url.pathname.split("/").filter(Boolean);
    return `${url.origin}/${parts.slice(0, -1).join("/")}/***`;
  } catch {
    return "FEISHU_BOT_WEBHOOK";
  }
}

export async function sendFeishuTextMessage(text: string): Promise<void> {
  const webhook = process.env.FEISHU_BOT_WEBHOOK?.trim();
  if (!webhook) {
    throw new Error("FEISHU_BOT_WEBHOOK 未配置，无法发送飞书运营日报。");
  }

  const payload: {
    msg_type: "text";
    content: { text: string };
    timestamp?: string;
    sign?: string;
  } = {
    msg_type: "text",
    content: { text }
  };

  const secret = process.env.FEISHU_BOT_SECRET?.trim();
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    payload.timestamp = timestamp;
    payload.sign = createFeishuSign(timestamp, secret);
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const bodyText = await response.text();
  let body: FeishuResponse | null = null;
  try {
    body = bodyText ? (JSON.parse(bodyText) as FeishuResponse) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(`飞书机器人请求失败：HTTP ${response.status}，Webhook=${redactedWebhook(webhook)}`);
  }

  const statusCode = body?.StatusCode ?? body?.code ?? 0;
  if (statusCode !== 0) {
    const message = body?.StatusMessage || body?.msg || bodyText || "未知错误";
    throw new Error(`飞书机器人返回失败：${message}`);
  }
}
