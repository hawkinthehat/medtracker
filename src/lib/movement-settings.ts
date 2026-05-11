/** Device-local labels — safe for shared installs; Jade’s defaults match her dogs. */

const LS_WALK_LABEL = "tiaki-movement-walk-button-label";
const LS_WALK_NOTES = "tiaki-movement-walk-notes-default";

export const DEFAULT_WALK_BUTTON_LABEL = "Walked the Dogs";
export const DEFAULT_WALK_NOTES =
  "Daily walk with Moki & Daisy";

export function getWalkButtonLabel(): string {
  if (typeof window === "undefined") return DEFAULT_WALK_BUTTON_LABEL;
  try {
    const v = window.localStorage.getItem(LS_WALK_LABEL)?.trim();
    return v || DEFAULT_WALK_BUTTON_LABEL;
  } catch {
    return DEFAULT_WALK_BUTTON_LABEL;
  }
}

export function getWalkNotesDefault(): string {
  if (typeof window === "undefined") return DEFAULT_WALK_NOTES;
  try {
    const v = window.localStorage.getItem(LS_WALK_NOTES)?.trim();
    return v || DEFAULT_WALK_NOTES;
  } catch {
    return DEFAULT_WALK_NOTES;
  }
}

export function setWalkButtonLabel(label: string): void {
  try {
    window.localStorage.setItem(LS_WALK_LABEL, label.trim());
  } catch {
    /* ignore */
  }
}

export function setWalkNotesDefault(notes: string): void {
  try {
    window.localStorage.setItem(LS_WALK_NOTES, notes.trim());
  } catch {
    /* ignore */
  }
}
