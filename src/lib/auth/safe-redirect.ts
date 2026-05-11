/** Prevent open redirects — only same-origin paths allowed. */
export function safeInternalPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed;
}
