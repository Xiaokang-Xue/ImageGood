"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Images, Plus, X } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { IMAGE_FILE_INPUT_ACCEPT, MAX_EDIT_REFERENCE_IMAGES } from "@/config/image-upload";
import {
  ImageNormalizationError,
  isPotentialImageFile,
  prepareImageFileForUpload
} from "@/lib/client-image-normalizer";

interface ReferenceItem {
  id: string;
  file: File;
  previewUrl: string;
  canPreview: boolean;
}

interface ReferenceImagePickerProps {
  disabled?: boolean;
  onChange: (files: File[]) => void;
}

function supportsBrowserPreview(file: File) {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
}

export function ReferenceImagePicker({ disabled = false, onChange }: ReferenceImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ReferenceItem[]>([]);
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const commit = (nextItems: ReferenceItem[]) => {
    setItems(nextItems);
    onChange(nextItems.map((item) => item.file));
  };

  const addFiles = async (files: File[]) => {
    if (disabled || files.length === 0) return;
    const remaining = MAX_EDIT_REFERENCE_IMAGES - items.length;
    if (remaining <= 0) {
      setError(`最多可添加 ${MAX_EDIT_REFERENCE_IMAGES} 张参考图`);
      return;
    }

    const selected = files.slice(0, remaining);
    if (selected.some((file) => !isPotentialImageFile(file))) {
      setError("请选择有效的图片文件");
      return;
    }

    setProcessing(true);
    setError("");
    try {
      const prepared = await Promise.all(selected.map((file) => prepareImageFileForUpload(file)));
      const nextItems = prepared.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
        canPreview: supportsBrowserPreview(file)
      }));
      commit([...items, ...nextItems]);
      if (files.length > remaining) setError(`已保留前 ${MAX_EDIT_REFERENCE_IMAGES} 张参考图`);
    } catch (uploadError) {
      setError(
        uploadError instanceof ImageNormalizationError
          ? uploadError.message
          : "参考图读取失败，请重新选择"
      );
    } finally {
      setProcessing(false);
    }
  };

  const removeItem = (id: string) => {
    const removed = items.find((item) => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    commit(items.filter((item) => item.id !== id));
    setError("");
  };

  return (
    <div className="mt-4 border-t border-neutral-200 pt-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left text-sm font-semibold text-neutral-700 transition hover:text-neutral-950 disabled:cursor-not-allowed disabled:text-neutral-400"
        disabled={disabled}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="flex items-center gap-2">
          <Images className="h-4 w-4" />
          参考图 <span className="font-normal text-neutral-400">可选</span>
        </span>
        <span className="text-xs font-normal text-neutral-400">{items.length}/{MAX_EDIT_REFERENCE_IMAGES}</span>
      </button>

      {expanded ? (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={IMAGE_FILE_INPUT_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = "";
              void addFiles(files);
            }}
          />

          {items.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {items.map((item, index) => (
                <div key={item.id} className="relative overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100">
                  {item.canPreview ? (
                    <SmartImage
                      src={item.previewUrl}
                      alt={`参考图 ${index + 1}`}
                      previewWidth={false}
                      className="h-24 w-full rounded-none border-0"
                    />
                  ) : (
                    <div className="flex h-24 flex-col items-center justify-center px-2 text-center text-neutral-500">
                      <ImageIcon className="h-5 w-5" />
                      <span className="mt-1 max-w-full truncate text-[11px]">{item.file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 z-20 rounded-full bg-black/70 p-1 text-white transition hover:bg-black"
                    aria-label={`移除参考图 ${index + 1}`}
                    disabled={disabled}
                    onClick={() => removeItem(item.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-neutral-500">可补充人物、商品、风格或细节参考，主图仍是最终编辑对象。</p>
          )}

          {items.length < MAX_EDIT_REFERENCE_IMAGES ? (
            <button
              type="button"
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 transition hover:border-neutral-500 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled || processing}
              onClick={() => inputRef.current?.click()}
            >
              <Plus className="h-4 w-4" />
              {processing ? "正在读取参考图" : "添加参考图"}
            </button>
          ) : null}

          {error ? <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
