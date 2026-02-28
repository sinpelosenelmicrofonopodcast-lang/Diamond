export function normalizeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const src = value.trim();
  if (!src || src === "null" || src === "undefined") return null;
  if (src.startsWith("/")) return src;

  try {
    const parsed = new URL(src);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return src;
    return null;
  } catch {
    return null;
  }
}

