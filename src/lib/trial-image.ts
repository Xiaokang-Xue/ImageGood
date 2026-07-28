const TRIAL_IMAGE_MARKER = "imagegood-trial";

export function markTrialImageUrl(
  url: string,
  taskId: string,
  state: "locked" | "unlocked"
) {
  const baseUrl = url.split("#")[0];
  return `${baseUrl}#${TRIAL_IMAGE_MARKER}-${state}:${encodeURIComponent(taskId)}`;
}

export function parseTrialImageUrl(url: string) {
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const match = hash.match(/^imagegood-trial-(locked|unlocked):(.+)$/);
  if (!match) return null;
  try {
    return {
      state: match[1] as "locked" | "unlocked",
      taskId: decodeURIComponent(match[2])
    };
  } catch {
    return null;
  }
}

export function requiresPaidImageDownload(url: string) {
  return parseTrialImageUrl(url)?.state === "locked";
}

export function trialDownloadLabel(url: string, fallback = "下载图片") {
  return requiresPaidImageDownload(url) ? "解锁无水印" : fallback;
}
