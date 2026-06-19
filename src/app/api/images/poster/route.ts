import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import { ImageRequestError } from "@/lib/server/image-validation";
import { runPosterTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";
import type { ImageSize, PosterImageRequest, PosterRatio, PosterStyle, PosterUsage } from "@/types/image";

export const runtime = "nodejs";

const usages = new Set<PosterUsage>(["xiaohongshu", "wechat", "community", "course", "checkin"]);
const styles = new Set<PosterStyle>(["clean", "premium", "cute", "tech", "handdrawn"]);
const ratios = new Set<PosterRatio>(["3:4", "1:1", "16:9", "9:16", "4:5"]);

function normalize<T extends string>(value: unknown, allowed: Set<T>, fallback: T) {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

function sizeFromRatio(ratio: PosterRatio): ImageSize {
  if (ratio === "16:9") return "1536x1024";
  if (ratio === "3:4" || ratio === "4:5" || ratio === "9:16") return "1024x1536";
  return "1024x1024";
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

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "ImageGood 封面海报";
    const subtitle = typeof body.subtitle === "string" ? body.subtitle.trim() : "";
    const usage = normalize(body.usage, usages, "xiaohongshu");
    const style = normalize(body.style, styles, "clean");
    const ratio = normalize(body.ratio, ratios, "3:4");

    const data = await runPosterTask({
      userId: user.id,
      title,
      subtitle,
      usage,
      style,
      ratio,
      size: sizeFromRatio(ratio)
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
