/** Stored in `pain_map.category` — stable snake_case keys. */
export type PainMapSymptomCategory =
  | "burning"
  | "tingling"
  | "numbness"
  | "hives"
  | "flushing"
  | "itching"
  | "deep_ache"
  | "point_tenderness"
  | "mcas_rash"
  /** Journal pain tracker — composite sensation groups */
  | "sfn_burning_tingling"
  | "mcas_rash_itch"
  | "fibro_deep_ache";

/** Stored in `pain_map.body_part_id`. */
export type SymptomBodyPartId =
  | "front_head"
  | "back_head"
  | "front_torso"
  | "front_arms"
  | "front_hands"
  | "front_legs"
  | "front_feet"
  | "back_torso"
  | "back_arms"
  | "back_hands"
  | "back_legs"
  | "back_feet";

export type SymptomRegionKey = "torso" | "arms" | "hands" | "feet";

export const SYMPTOM_BODY_LABELS: Record<SymptomBodyPartId, string> = {
  front_head: "Front — head",
  back_head: "Back — head",
  front_torso: "Front — torso",
  front_arms: "Front — arms",
  front_hands: "Front — hands",
  front_legs: "Front — legs",
  front_feet: "Front — feet",
  back_torso: "Back — torso",
  back_arms: "Back — arms",
  back_hands: "Back — hands",
  back_legs: "Back — legs",
  back_feet: "Back — feet",
};

export type SymptomGroupId = "SFN" | "MCAS" | "FIBRO";

export type SymptomToggleDef = {
  category: PainMapSymptomCategory;
  label: string;
};

export const SYMPTOM_TOGGLE_GROUPS: Record<
  SymptomGroupId,
  { title: string; toggles: SymptomToggleDef[] }
> = {
  SFN: {
    title: "SFN",
    toggles: [
      { category: "burning", label: "Burning" },
      { category: "tingling", label: "Tingling" },
      { category: "numbness", label: "Numbness" },
    ],
  },
  MCAS: {
    title: "MCAS",
    toggles: [
      { category: "hives", label: "Hives" },
      { category: "flushing", label: "Flushing" },
      { category: "itching", label: "Itching" },
    ],
  },
  FIBRO: {
    title: "FIBRO",
    toggles: [
      { category: "deep_ache", label: "Deep ache" },
      { category: "point_tenderness", label: "Point tenderness" },
    ],
  },
};

export function bodyPartId(
  side: "front" | "back",
  region: SymptomRegionKey,
): SymptomBodyPartId {
  return `${side}_${region}` as SymptomBodyPartId;
}

/** Journal body chart: head, torso, hands, feet (front / back in `body_part_id`). */
export type JournalBodyRegion = "head" | "torso" | "hands" | "feet";

export const JOURNAL_PAIN_CATEGORIES: {
  label: string;
  category: PainMapSymptomCategory;
}[] = [
  { label: "SFN (Burning/Tingling)", category: "sfn_burning_tingling" },
  { label: "MCAS (Rash/Itch)", category: "mcas_rash_itch" },
  { label: "Fibro (Deep Ache)", category: "fibro_deep_ache" },
];

export function journalBodyPartId(
  side: "front" | "back",
  region: JournalBodyRegion,
): SymptomBodyPartId {
  return `${side}_${region}` as SymptomBodyPartId;
}
