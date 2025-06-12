export const Hosts = {
  API: "api.deco.chat",
  APPS: "deco.page",
  FS: "fs.deco.chat",
  Chat: "deco.chat",
  APPS_OUTBOUND: "used-for-apps-outbound-requests.deco.chat",
  LOCALHOST: "localhost:3000",
} as const;

export const WELL_KNOWN_ORIGINS = [
  `http://${Hosts.LOCALHOST}`,
  `https://${Hosts.Chat}`,
] as const;
