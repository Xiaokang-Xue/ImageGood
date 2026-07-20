"use client";

import { useRouter } from "next/navigation";
import { UploadDropzone } from "@/components/ui/UploadDropzone";
import { useStudioStore } from "@/lib/studio-store";

export function HomeUploadAction() {
  const router = useRouter();
  const setUploadedImage = useStudioStore((state) => state.setUploadedImage);

  return (
    <UploadDropzone
      compact
      title="点击上传图片"
      subtitle=""
      showFormatDetails={false}
      className="min-h-[190px] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
      onImageSelected={(imageUrl, file) => {
        setUploadedImage(imageUrl, file);
        router.push("/editor");
      }}
    />
  );
}
