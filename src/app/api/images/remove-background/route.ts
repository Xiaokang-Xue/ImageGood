import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import { getFormString, getRequiredImageFile, normalizeImageQuality, normalizeImageSize } from "@/lib/server/image-validation";
import { runRemoveBackgroundTask } from "@/lib/server/image-task-service";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("UNAUTHORIZED");
    assertContactVerified(user);

    const formData = await request.formData();
    const image = await getRequiredImageFile(formData);
    const prompt = getFormString(formData, "prompt");

    const data = await runRemoveBackgroundTask({
      userId: user.id,
      image,
      prompt,
      size: normalizeImageSize(getFormString(formData, "size", "1024x1024")),
      quality: normalizeImageQuality(getFormString(formData, "quality", "auto"))
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
