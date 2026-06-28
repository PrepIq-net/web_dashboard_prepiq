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
  last_heartbeat_at: z.string().nullable(),
  last_sync_at: z.string().nullable(),
  records_synced_today: z.number(),
  is_active: z.boolean(),
});

export const ConnectorListSchema = z.object({
  message: z.string(),
  data: z.array(ConnectorDataSchema),
});

export type ConnectorData = z.infer<typeof ConnectorDataSchema>;
export type ConnectorList = z.infer<typeof ConnectorListSchema>;