import { NextResponse } from "next/server";
import { assertContactVerified } from "@/lib/server/auth-guards";
import { imageErrorResponse } from "@/lib/server/image-route-utils";
import {
  getFormString,
  getRequiredImageFile,
  normalizeEditTool,
  normalizeImageQuality,
  normalizeImageSize,
  normalizeOutputFormat
} from "@/lib/server/image-validation";
import { runEditTask } from "@/lib/server/image-task-service";
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
    const tool = normalizeEditTool(getFormString(formData, "tool", "custom"));
    const size = normalizeImageSize(getFormString(formData, "size", "1024x1024"));
    const quality = normalizeImageQuality(getFormString(formData, "quality", "auto"));
    const outputFormat = normalizeOutputFormat(getFormString(formData, "outputFormat", "png"));

    const data = await runEditTask({
      userId: user.id,
      image,
      prompt,
      tool,
      size,
      quality,
      outputFormat
    });

    return NextResponse.json(data);
  } catch (error) {
    return imageErrorResponse(error);
  }
}
