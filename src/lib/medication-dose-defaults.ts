/** Sensible defaults when opening dose editor (mg). */
export function defaultDoseMgForMedicationName(name: string): number {
  const n = name.trim().toLowerCase();
  const map: Record<string, number> = {
    duloxetine: 60,
    lorazepam: 1,
    trazodone: 50,
    latuda: 40,
    gleevec: 400,
    fluconazole: 100,
    pregabalin: 300,
  };
  return map[n] ?? 20;
}
