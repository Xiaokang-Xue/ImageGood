import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import { ImageRequestError } from "@/lib/server/image-validation";
import { runPosterTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";
import type { ImageSize, PosterImageRequest, PosterUsage } from "@/types/image";

export const runtime = "nodejs";

const usages = new Set<PosterUsage>(["xiaohongshu", "wechat", "community", "course", "checkin"]);

function normalize<T extends string>(value: unknown, allowed: Set<T>, fallback: T) {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

function sizeForUsage(usage: PosterUsage): ImageSize {
  return usage === "wechat" || usage === "course" ? "1536x1024" : "1024x1536";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("UNAUTHORIZED");
    assertContactVerified(user);

    let body: Partial<PosterImageRequest>;

    try {
      body = (await request.json()) as Partial<PosterImageRequest>;
    } catch {
      throw new ImageRequestError("INVALID_JSON", "请求参数格式不正确");
    }

    const usage = normalize(body.usage, usages, "xiaohongshu");
    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : [body.title, body.subtitle].filter((value) => typeof value === "string" && value.trim()).join("，");

    const data = await runPosterTask({
      requestId: body.requestId,
      userId: user.id,
      usage,
      prompt,
      size: sizeForUsage(usage)
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
