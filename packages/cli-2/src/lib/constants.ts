const LOCAL_DEBUGGER = process.env.VITE_USE_LOCAL_BACKEND === "true";

export const SUPABASE_URL = "https://auth.deco.cx";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96a3NnZG15cnFjeGN3aG5iZXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3ODI5NjYsImV4cCI6MjA2MzM1ODk2Nn0.fx_Ouo3V-s4ZWr0MJ8gP5PFkr11xEkxThKiNDZSLRyY";

export const DECO_CHAT_WEB = LOCAL_DEBUGGER
  ? "http://localhost:3000"
  : "https://deco.chat";

export const DECO_CHAT_API_PROD = "https://api.deco.chat";
export const DECO_CHAT_API_LOCAL = "http://localhost:3001";

export const DECO_CHAT_API = LOCAL_DEBUGGER
  ? DECO_CHAT_API_LOCAL
  : DECO_CHAT_API_PROD;

export const AUTH_PORT_CLI = 3457;
export const AUTH_URL_CLI = `http://localhost:${AUTH_PORT_CLI}`;

export const DECO_CHAT_LOGIN = new URL("/login?cli", DECO_CHAT_WEB).href;