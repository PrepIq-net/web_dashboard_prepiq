import z from "zod";

export interface creatConnetorToken {
  id: string;
}

export interface ResponseTokenConnector {
  token: string;
  expires_at: Date;
  branch_id: string;
}

export const ConnectorTokenSchema = z.object({
  message: z.string(),
  data: z.object({
    token: z.string(),
    expires_at: z.string(),
    branch_id: z.string(),
  }),
});

export type ConnectorToken = z.infer<typeof ConnectorTokenSchema>;

export const ConnectorDataSchema = z.object({
  id: z.string().uuid(),
  branch: z.string(),
  machine_id: z.string(),
  connector_version: z.string(),
  status: z.string(),
  is_online: z.boolean(),
  last_heartbeat_at: z.string(),
  last_sync_at: z.string(),
  records_synced_today: z.number(),
  is_active: z.boolean(),
});

export const ConnectorListSchema = z.object({
  message: z.string(),
  data: z.array(ConnectorDataSchema),
});
export type ConnectorData = z.infer<typeof ConnectorDataSchema>;
export type ConnectorList = z.infer<typeof ConnectorListSchema>;

export const connectorsDummy: ConnectorData[] = [
  {
    id: "1",
    branch: "Main Branch",
    machine_id: "mc-001",
    connector_version: "1.4.2",
    status: "healthy",
    is_online: true,
    last_heartbeat_at: "2026-06-26 10:12",
    last_sync_at: "2026-06-26 10:10",
    records_synced_today: 12500,
    is_active: true,
  },
  {
    id: "2",
    branch: "East Wing",
    machine_id: "mc-002",
    connector_version: "1.3.8",
    status: "warning",
    is_online: true,
    last_heartbeat_at: "2026-06-26 09:55",
    last_sync_at: "2026-06-26 09:50",
    records_synced_today: 8420,
    is_active: true,
  },
  {
    id: "3",
    branch: "West Wing",
    machine_id: "mc-003",
    connector_version: "2.0.1",
    status: "offline",
    is_online: false,
    last_heartbeat_at: "2026-06-25 18:20",
    last_sync_at: "2026-06-25 18:00",
    records_synced_today: 0,
    is_active: false,
  },
  {
    id: "4",
    branch: "HQ",
    machine_id: "mc-004",
    connector_version: "1.1.0",
    status: "healthy",
    is_online: true,
    last_heartbeat_at: "2026-06-26 10:15",
    last_sync_at: "2026-06-26 10:14",
    records_synced_today: 30000,
    is_active: true,
  },
];
