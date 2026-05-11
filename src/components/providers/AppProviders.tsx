"use client";

/** Light mode only — no `next-themes` ThemeProvider; shell uses fixed light palette. */

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState } from "react";
import WeatherHourlyLogger from "@/components/providers/WeatherHourlyLogger";
import MedicationsHydrator from "@/components/providers/MedicationsHydrator";
import MedicationExpiryWatcher from "@/components/providers/MedicationExpiryWatcher";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 60 * 24 * 30,
            staleTime: 1000 * 60,
            retry: 1,
          },
        },
      })
  );

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: window.localStorage,
      key: "medtracker-rq-v1",
    })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 30,
      }}
    >
      <MedicationsHydrator />
      <MedicationExpiryWatcher />
      <WeatherHourlyLogger />
      {children}
    </PersistQueryClientProvider>
  );
}
