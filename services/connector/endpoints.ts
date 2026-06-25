const CONNECT = () => `api/connectors`;

export const PrepConnector = {
  createToken: () => `${CONNECT()}/tokens/`,
  refreshConnectorToken: () => `${CONNECT()}token/refresh/`,
  listConnector: (orgId: string) => `${CONNECT()}/?org_id=${orgId}`,

  connectorDetail: (connectorId: string) => `${CONNECT()}/${connectorId}`,
  connectorLogs: (connectorId: string) => `${CONNECT()}/${connectorId}/logs/`,
  connectorHeartbeat: (connectorId: string) =>
    `${CONNECT()}/${connectorId}/heartbeat/`,
  connectorSchema: (connectorId: string) =>
    `${CONNECT()}/${connectorId}/schema/`,

  mappingConnectorUpdate: (connectorId: string) =>
    `${CONNECT()}/${connectorId}/mappings/`,
  connectorSyncConfig: (connectorId: string) =>
    `${CONNECT()}/${connectorId}/sync-config/`,
};
