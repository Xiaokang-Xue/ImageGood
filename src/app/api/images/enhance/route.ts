import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import { getFormString, getRequiredImageFile, normalizeImageQuality, normalizeImageSize } from "@/lib/server/image-validation";
import { runImageEnhanceTask } from "@/lib/server/image-task-service";
import { resolveInputImageSize } from "@/lib/server/image-size-policy";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("UNAUTHORIZED");
    assertContactVerified(user);

    const formData = await request.formData();
    const requestId = getFormString(formData, "requestId");
    const image = await getRequiredImageFile(formData);
    const prompt = getFormString(formData, "prompt");
    const requestedSize = normalizeImageSize(getFormString(formData, "size", "auto"));
    const size = await resolveInputImageSize({ image, prompt, requestedSize });

    const data = await runImageEnhanceTask({
      requestId,
      userId: user.id,
      image,
      prompt,
      size,
      quality: normalizeImageQuality(getFormString(formData, "quality", "auto"))
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
