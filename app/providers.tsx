"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { IconoirProvider } from "iconoir-react";
import { ReactNode, useState } from "react";
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
      </IconoirProvider>
    </QueryClientProvider>
  );
}
