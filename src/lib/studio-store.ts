"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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
      partialize: (state) => ({
        uploadedImage: state.uploadedImage,
        uploadedImageFile: null,
        currentImage: state.currentImage,
        currentImageFile: null,
        prompt: state.prompt,
        selectedTool: state.selectedTool,
        editResults: state.editResults,
        selectedResult: state.selectedResult,
        history: state.history.slice(-20)
      })
    }
  )
);
