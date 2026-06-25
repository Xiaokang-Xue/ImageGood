import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import { ImageRequestError, normalizeImageQuality, normalizeImageSize, normalizeOutputFormat } from "@/lib/server/image-validation";
import { runTextToImageTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";
import type { TextToImageRequest, TextToImageStyle } from "@/types/image";

export const runtime = "nodejs";

const textStyles = new Set<TextToImageStyle>(["realistic", "product", "poster", "illustration", "minimal"]);

function normalizeTextStyle(value: unknown): TextToImageStyle {
  return typeof value === "string" && textStyles.has(value as TextToImageStyle) ? (value as TextToImageStyle) : "realistic";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("UNAUTHORIZED");
    assertContactVerified(user);

    let body: Partial<TextToImageRequest>;
    try {
      body = (await request.json()) as Partial<TextToImageRequest>;
    } catch {
      throw new ImageRequestError("INVALID_JSON", "请求参数格式不正确");
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 4) {
      throw new ImageRequestError("PROMPT_REQUIRED", "请先输入想生成的图片描述");
    }

    const data = await runTextToImageTask({
      userId: user.id,
      prompt,
      style: normalizeTextStyle(body.style),
      size: normalizeImageSize(typeof body.size === "string" ? body.size : "1024x1024"),
      quality: normalizeImageQuality(body.quality || "auto"),
      outputFormat: normalizeOutputFormat(body.outputFormat || "png")
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
