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
    //     expires_at: z.coerce.date(),
    branch_id: z.string(),
  }),
});

export type ConnectorToken = z.infer<typeof ConnectorTokenSchema>;

export const ConnectorDataSchema = z.object({
  id: z.string().uuid(),
  branch: z.string(),
  name: z.string(),
  display_name: z.string(),
  machine_id: z.string(),
  hostname: z.string(),
  os_info: z.string(),
  connector_version: z.string(),
  status: z.string(),
  is_online: z.boolean(),
  last_heartbeat_at: z.string(),
  last_sync_at: z.string(),
  records_synced_today: z.number(),
  db_type: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ConnectorListSchema = z.object({
  message: z.string(),
  data: z.array(ConnectorDataSchema),
});

export interface connectorData {
  id: string;
  branch: string;
  name: string;
  display_name: string;
  machine_id: string;
  hostname: string;
  os_info: string;
  connector_version: string;
  status: string;
  is_online: string;
  last_heartbeat_at: string;
  last_sync_at: string;
  records_synced_today: string;
  db_type: string;
  is_active: string;
  created_at: string;
  updated_at: string;
}

export interface connectorList {
  message: string;
  data: connectorData[];
}
