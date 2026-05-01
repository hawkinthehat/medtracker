import type { JournalSetting } from "@/lib/types";

export function labelJournalSetting(setting?: JournalSetting): string {
  switch (setting) {
    case "indoor":
      return "Indoor";
    case "outdoor":
      return "Outdoor";
    case "unspecified":
      return "Not specified";
    default:
      return "Not specified";
  }
}
