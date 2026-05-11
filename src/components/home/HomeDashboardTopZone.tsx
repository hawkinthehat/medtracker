"use client";

import TiakiHomeWeatherSection from "@/components/home/TiakiHomeWeatherSection";
import { SetupChecklistCarouselSlides } from "@/components/home/NewUserSetupChecklist";
import { TiakiFirstTimeCarouselSlide } from "@/components/home/TiakiFirstTimeMedicationSetup";

const CAROUSEL_ROW =
  "flex max-h-[75vh] min-h-0 gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 pt-1 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory";

const WEATHER_SHELL =
  "flex h-[min(75vh,calc(100dvh-10rem))] max-h-[75vh] min-h-0 w-[min(92vw,420px)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-sm";

const WEATHER_INNER =
  "min-h-0 max-h-[75vh] flex-1 overflow-y-auto overscroll-contain px-2 py-2";

type HomeDashboardTopZoneProps = {
  bypassBarometerAdvisory?: boolean;
};

/**
 * Carousel for weather / advisory / onboarding — cards use max 75vh with internal
 * scroll + sticky actions so taps stay reachable on small phones.
 */
export default function HomeDashboardTopZone({
  bypassBarometerAdvisory = false,
}: HomeDashboardTopZoneProps) {
  return (
    <section
      aria-label="Dashboard highlights"
      className="relative max-h-[75vh] shrink-0 min-h-0"
    >
      <p className="sr-only">
        Swipe horizontally for weather, setup steps, and welcome tips.
      </p>
      <div className={CAROUSEL_ROW}>
        <div className={WEATHER_SHELL}>
          <div className={WEATHER_INNER}>
            <TiakiHomeWeatherSection
              compact
              skipBarometerAdvisory={bypassBarometerAdvisory}
            />
          </div>
        </div>
        <SetupChecklistCarouselSlides />
        <TiakiFirstTimeCarouselSlide />
      </div>
    </section>
  );
}
