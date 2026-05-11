/** Sensible defaults when opening dose editor (mg) — common generic strengths. */
export function defaultDoseMgForMedicationName(name: string): number {
  const n = name.trim().toLowerCase();
  const map: Record<string, number> = {
    gleevec: 100,
    buspirone: 30,
    pregabalin: 75,
    estradiol: 2,
    trazodone: 100,
    magnesium: 1000,
    latuda: 120,
    midodrine: 10,
    duloxetine: 60,
    methylphenidate: 10,
    thermotabs: 360,
    methocarbamol: 750,
    lorazepam: 0.5,
    ondansetron: 4,
  };
  return map[n] ?? 20;
}
