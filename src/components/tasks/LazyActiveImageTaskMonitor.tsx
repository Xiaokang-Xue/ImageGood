"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ACTIVE_IMAGE_TASKS_KEY = "imagegood:active-image-tasks:v1";
const ActiveImageTaskMonitor = dynamic(
  () =>
    import("@/components/tasks/ActiveImageTaskMonitor").then(
      (module) => module.ActiveImageTaskMonitor
    ),
  { ssr: false }
);

function hasTrackedTasks() {
  try {
    const raw = window.localStorage.getItem(ACTIVE_IMAGE_TASKS_KEY);
    return Boolean(raw && raw !== "[]");
  } catch {
    return false;
  }
}

export function LazyActiveImageTaskMonitor() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const enableWhenNeeded = () => {
      if (hasTrackedTasks()) setEnabled(true);
    };

    enableWhenNeeded();
    window.addEventListener("imagegood-active-tasks-updated", enableWhenNeeded);
    return () => {
      window.removeEventListener("imagegood-active-tasks-updated", enableWhenNeeded);
    };
  }, []);

  return enabled ? <ActiveImageTaskMonitor /> : null;
}
