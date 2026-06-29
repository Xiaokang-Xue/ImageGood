import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import { getFormString, getRequiredImageFile, normalizeImageQuality, normalizeImageSize } from "@/lib/server/image-validation";
import { runImageEnhanceTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("UNAUTHORIZED");
    assertContactVerified(user);

    const formData = await request.formData();
    const image = getRequiredImageFile(formData);

    const data = await runImageEnhanceTask({
      userId: user.id,
      image,
      prompt: getFormString(formData, "prompt"),
      size: normalizeImageSize(getFormString(formData, "size", "1024x1024")),
      quality: normalizeImageQuality(getFormString(formData, "quality", "auto"))
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
