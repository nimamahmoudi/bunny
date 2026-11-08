// Copy text to the clipboard. Tries the async Clipboard API
// first, then the legacy execCommand fallback (both need a user
// gesture in most browsers — a click or keypress — so callers
// should call this from a gesture handler where possible, and
// retry on the next interaction when an on-load attempt fails).
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const clipboard =
    typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
