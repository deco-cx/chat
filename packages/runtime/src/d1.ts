import {
  D1Store as MastraD1Store,
  D1ClientConfig as MastraD1StoreConfig,
} from "@mastra/cloudflare-d1";

export class D1Store extends MastraD1Store {
  constructor(private config: MastraD1StoreConfig) {
    super(config);
  }

  override async init() {
    await super.init();

    // Create indexes for better performance on frequently queried columns
    const indexQueries = [
      {
        sql: "CREATE INDEX IF NOT EXISTS idx_mastra_workflow_snapshot_created_at ON mastra_workflow_snapshot(createdAt)",
        params: [],
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS idx_mastra_messages_created_at ON mastra_messages(createdAt)",
        params: [],
      },
    ];

    // Execute each index creation query
    for (const { sql, params } of indexQueries) {
      await this.config.client.query({
        sql,
        params,
      });
    }
  }
}
