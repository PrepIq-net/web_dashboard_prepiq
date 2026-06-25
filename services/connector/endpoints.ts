const CONNECT = () => `api/connectors`;

export const PrepConnector = {
  createToken: () => `${CONNECT()}/tokens/`,
  RegisterConnector: () => `${CONNECT()}register/`,
  refreshConnectorToken: () => `${CONNECT()}token/refresh/`,
  listConnector: () => `${CONNECT()}`,

  connectorDetail: () => `${CONNECT()}token/refresh/`,
  connectorLogs: () => `${CONNECT()}token/refresh/`,
  connectorHeartbeat: () => `${CONNECT()}heartbeat/`,
  connectorSchema: () => `${CONNECT()}schema/`,

  mappingConnectorUpdate: () => `${CONNECT()}mappings/`,
  connectorSyncConfig: () => `${CONNECT()}sync-config/`,
};
