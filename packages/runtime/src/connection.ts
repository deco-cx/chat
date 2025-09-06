export type SSEConnection = {
  type: "SSE";
  url: string;
  token?: string;
  headers?: Record<string, string>;
};

export type WebsocketConnection = {
  type: "Websocket";
  url: string;
  token?: string;
};

export type DecoConnection = {
  type: "Deco";
  tenant: string;
  token?: string;
};

export type InnateConnection = {
  type: "INNATE";
  name: string;
  workspace?: string;
};

export type HTTPConnection = {
  type: "HTTP";
  url: string;
  headers?: Record<string, string>;
  token?: string;
};

export type MCPConnection =
  | SSEConnection
  | WebsocketConnection
  | InnateConnection
  | DecoConnection
  | HTTPConnection;

export type Integration = {
  /** Unique identifier for the MCP */
  id: string;
  /** Human-readable name of the integration */
  name: string;
  /** Brief description of the integration's functionality */
  description?: string;
  /** URL to the integration's icon */
  icon?: string;
  /** Access level of the integration */
  access?: string | null;
  /** Connection configuration */
  connection: MCPConnection;
};
