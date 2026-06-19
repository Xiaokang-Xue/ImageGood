import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import { getFormString, getRequiredImageFile } from "@/lib/server/image-validation";
import { runProductTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";
import type { ImageSize, ProductRatio, ProductScene, ProductStyle, ProductTemplate } from "@/types/image";

export const runtime = "nodejs";

const templates = new Set<ProductTemplate>(["white-bg", "lifestyle", "festival", "social"]);
const scenes = new Set<ProductScene>(["kitchen", "bedroom", "desk", "outdoor", "gift"]);
const styles = new Set<ProductStyle>(["minimal", "premium", "warm", "fresh"]);
const ratios = new Set<ProductRatio>(["1:1", "3:4", "4:3", "16:9"]);

function normalize<T extends string>(value: string, allowed: Set<T>, fallback: T) {
  return allowed.has(value as T) ? (value as T) : fallback;
}

function sizeFromRatio(ratio: ProductRatio): ImageSize {
  if (ratio === "3:4") return "1024x1536";
  if (ratio === "4:3" || ratio === "16:9") return "1536x1024";
  return "1024x1024";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("UNAUTHORIZED");
    assertContactVerified(user);

    const formData = await request.formData();
    const image = getRequiredImageFile(formData);
    const template = normalize(getFormString(formData, "template", "white-bg"), templates, "white-bg");
    const scene = normalize(getFormString(formData, "scene", "desk"), scenes, "desk");
    const style = normalize(getFormString(formData, "style", "premium"), styles, "premium");
    const sellingPoints = getFormString(formData, "sellingPoints");
    const ratio = normalize(getFormString(formData, "ratio", "1:1"), ratios, "1:1");

    const data = await runProductTask({
      userId: user.id,
      image,
      template,
      scene,
      style,
      sellingPoints,
      ratio,
      size: sizeFromRatio(ratio)
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
