import { apiClient } from "@/lib/api/client";
import { PrepConnector } from "./endpoints";
import { ConnectorListSchema, ConnectorTokenSchema } from "./types";

export async function createConnectorToken(branchId: string) {
  const response = await apiClient<unknown>(PrepConnector.createToken(), {
    method: "POST",
    body: { branch_id: branchId },
  });

  const parsed = ConnectorTokenSchema.safeParse(response);

  if (!parsed.success) {
    throw new Error("Unexpected connector token response format.");
  }

  return parsed.data;
}

export async function listConnectors(orgId: string) {
  const response = await apiClient<unknown>(
    PrepConnector.listConnector(orgId),
    {
      method: "GET",
    },
  );

  return ConnectorListSchema.safeParse(response);
}
