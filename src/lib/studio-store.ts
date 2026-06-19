"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isPersistableImageUrl, safeStorageGet, safeStorageRemove, safeStorageSet } from "@/lib/safe-client-storage";
import type { EditImageResult, EditTool, HistoryItem } from "@/types/image";

interface StudioState {
  uploadedImage: string | null;
  uploadedImageFile: File | null;
  currentImage: string | null;
  currentImageFile: File | null;
  prompt: string;
  selectedTool: EditTool;
  editResults: EditImageResult[];
  selectedResult: EditImageResult | null;
  history: HistoryItem[];
  setUploadedImage: (imageUrl: string, file?: File | null) => void;
  setCurrentImage: (imageUrl: string, file?: File | null) => void;
  setPrompt: (prompt: string) => void;
  setSelectedTool: (tool: EditTool) => void;
  setEditResults: (results: EditImageResult[]) => void;
  setSelectedResult: (result: EditImageResult) => void;
  addHistoryItem: (item: HistoryItem) => void;
}

type PersistedStudioState = Pick<
  StudioState,
  "uploadedImage" | "uploadedImageFile" | "currentImage" | "currentImageFile" | "prompt" | "selectedTool" | "editResults" | "selectedResult" | "history"
>;

function persistableResult(result: EditImageResult | null) {
  if (!result || !isPersistableImageUrl(result.url)) return null;
  return result;
}

function persistableHistoryItem(item: HistoryItem) {
  if (!isPersistableImageUrl(item.thumbnail)) {
    return { ...item, thumbnail: "" };
  }
  return item;
}

export const useStudioStore = create<StudioState>()(
  persist<StudioState, [], [], PersistedStudioState>(
    (set) => ({
      uploadedImage: null,
      uploadedImageFile: null,
      currentImage: null,
      currentImageFile: null,
      prompt: "",
      selectedTool: "custom",
      editResults: [],
      selectedResult: null,
      history: [],
      setUploadedImage: (imageUrl, file = null) =>
        set(() => ({
          uploadedImage: imageUrl,
          uploadedImageFile: file,
          currentImage: imageUrl,
          currentImageFile: file,
          selectedResult: null,
          editResults: [],
          history: [
            {
              id: `history-upload-${Date.now()}`,
              title: "上传原图",
              createdAt: new Date().toISOString(),
              thumbnail: imageUrl
            }
          ]
        })),
      setCurrentImage: (imageUrl, file = null) => set({ currentImage: imageUrl, currentImageFile: file }),
      setPrompt: (prompt) => set({ prompt }),
      setSelectedTool: (tool) => set({ selectedTool: tool }),
      setEditResults: (results) => set({ editResults: results }),
      setSelectedResult: (result) => set({ selectedResult: result }),
      addHistoryItem: (item) => set((state) => ({ history: [...state.history, item].slice(-20) }))
    }),
    {
      name: "imagegood-editor-workspace",
      storage: createJSONStorage(() => ({
        getItem: safeStorageGet,
        setItem: (key, value) => {
          safeStorageSet(key, value);
        },
        removeItem: safeStorageRemove
      })),
      partialize: (state) => ({
        uploadedImage: isPersistableImageUrl(state.uploadedImage) ? state.uploadedImage : null,
        uploadedImageFile: null,
        currentImage: isPersistableImageUrl(state.currentImage) ? state.currentImage : null,
        currentImageFile: null,
        prompt: state.prompt,
        selectedTool: state.selectedTool,
        editResults: state.editResults.filter((result) => isPersistableImageUrl(result.url)).slice(-5),
        selectedResult: persistableResult(state.selectedResult),
        history: state.history.slice(-10).map(persistableHistoryItem)
      })
    }
  )
);
