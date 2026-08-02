"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { IconoirProvider } from "iconoir-react";
import { ReactNode, useState } from "react";
import { Toaster } from "react-hot-toast";
import { createQueryClient } from "@/lib/api/query-client";
import {
  createPersister,
  shouldPersistQuery,
  PERSIST_MAX_AGE,
  PERSIST_BUSTER,
} from "@/lib/api/persist";
import { SidebarStateProvider } from "@/components/dashboard/sidebar-state";
import { LanguageProvider } from "@/lib/i18n/language-context";

type ProvidersProps = {
  children: ReactNode;
  /**
   * Who this browser is currently acting as. Folded into the persistence
   * buster so switching identity — an admin starting a read-only support
   * session on a browser already signed in as themselves — throws away the
   * previous identity's persisted cache instead of rehydrating it under the
   * new one. The denylist already keeps profile/branch/billing off disk; this
   * covers everything else, which is branch-scoped and would otherwise be one
   * shared org away from showing the wrong numbers.
   */
  cacheScope?: string;
};

export function Providers({ children, cacheScope }: ProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());
  const [persister] = useState(() => createPersister());
  const buster = cacheScope ? `${PERSIST_BUSTER}:${cacheScope}` : PERSIST_BUSTER;

  return (
    <LanguageProvider>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <IconoirProvider
        iconProps={{
          color: "currentColor",
          strokeWidth: 1.5,
          width: "1.1em",
          height: "1.1em",
        }}
      >
        <SidebarStateProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#1C1C1F",
                color: "#F5F5F7",
                border: "1px solid #2A2A2E",
                borderRadius: "12px",
                fontSize: "14px",
                padding: "12px 16px",
              },
              success: {
                iconTheme: {
                  primary: "#3F8F68",
                  secondary: "#F5F5F7",
                },
              },
              error: {
                iconTheme: {
                  primary: "#C44949",
                  secondary: "#F5F5F7",
                },
              },
            }}
          />
        </SidebarStateProvider>
      </IconoirProvider>
    </PersistQueryClientProvider>
    </LanguageProvider>
  );
}
