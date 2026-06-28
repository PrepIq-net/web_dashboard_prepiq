import { apiClient } from "@/lib/api/client";
import { PrepConnector } from "./endpoints";
import { ConnectorList, ConnectorListSchema, ConnectorTokenSchema } from "./types";

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
  const response = await apiClient<ConnectorList>(
    PrepConnector.listConnector(orgId),
    {
      method: "GET",
    },
  );

  const parsed = ConnectorListSchema.parse(response);

  return parsed.data;
}
