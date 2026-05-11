/** Latest outdoor snapshot from OpenWeatherMap (updated by WeatherHourlyLogger). */

export type EnvironmentSnapshot = {
  pressureHpa: number;
  tempC: number;
  /** Relative humidity % when available from OpenWeather. */
  humidityPct?: number;
  recordedAt: string;
};

let snapshot: EnvironmentSnapshot | null = null;

export function setEnvironmentSnapshot(next: EnvironmentSnapshot): void {
  snapshot = next;
}

export function getEnvironmentSnapshot(): EnvironmentSnapshot | null {
  return snapshot;
}
