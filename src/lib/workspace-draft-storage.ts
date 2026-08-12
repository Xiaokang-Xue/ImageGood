"use client";

import { safeStorageRemove } from "@/lib/safe-client-storage";

export const EDITOR_DRAFT_STORAGE_KEY = "imagegood-editor-workspace";
export const PRODUCT_DRAFT_STORAGE_KEY = "imagegood-product-studio-draft";
export const POSTER_DRAFT_STORAGE_KEY = "imagegood-poster-studio-draft-v2";

const WORKSPACE_DRAFT_KEYS = [EDITOR_DRAFT_STORAGE_KEY, PRODUCT_DRAFT_STORAGE_KEY, POSTER_DRAFT_STORAGE_KEY];
const RESET_MARKER_KEY = "imagegood-workspace-reset-load";

function isReloadNavigation() {
  if (typeof window === "undefined") return false;

  const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) return navigation.type === "reload";

  return window.performance.navigation?.type === 1;
}

export function clearWorkspaceDraftsOnReload() {
  if (typeof window === "undefined" || !isReloadNavigation()) return;

  const loadId = String(window.performance.timeOrigin);
  try {
    if (window.sessionStorage.getItem(RESET_MARKER_KEY) === loadId) return;
    WORKSPACE_DRAFT_KEYS.forEach(safeStorageRemove);
    window.sessionStorage.setItem(RESET_MARKER_KEY, loadId);
  } catch {
    WORKSPACE_DRAFT_KEYS.forEach(safeStorageRemove);
  }
}
