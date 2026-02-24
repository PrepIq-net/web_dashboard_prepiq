"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { IconoirProvider } from "iconoir-react";
import { ReactNode, useState } from "react";
import { Toaster } from "react-hot-toast";
import { createQueryClient } from "@/lib/api/query-client";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <IconoirProvider
        iconProps={{
          color: "currentColor",
          strokeWidth: 1.5,
          width: "1.1em",
          height: "1.1em",
        }}
      >
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
      </IconoirProvider>
    </QueryClientProvider>
  );
}
