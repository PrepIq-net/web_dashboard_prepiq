import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as tokenConnector from "./service";
import toast from "react-hot-toast";

export function useCreateConnectorToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      tokenConnector.createConnectorToken(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connector-token"] });
    },

    onError: (error: any) => {
      const message = error?.message || "Failed to create token.";
      const istokenLimitError =
        String(message).toLowerCase().includes("maximum of") &&
        String(message).toLowerCase().includes("branch");

      if (!istokenLimitError) {
        toast.error(message);
      }
    },
  });
}

export function usePrepConectors(orgId: string) {
  return useQuery({
    queryKey: ["connectors", orgId],
    queryFn: () => tokenConnector.listConnectors(orgId),
    enabled: !!orgId,
  });
}
