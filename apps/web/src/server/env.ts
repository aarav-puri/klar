import "server-only";

/** Server-side configuration. Secrets never leave this module's callers. */
export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  tokenKey: process.env.TOKEN_ENCRYPTION_KEY ?? "",
  schoologyKey: process.env.SCHOOLOGY_CONSUMER_KEY ?? "",
  schoologySecret: process.env.SCHOOLOGY_CONSUMER_SECRET ?? "",
  schoologyApiBase: (process.env.SCHOOLOGY_API_BASE ?? "https://api.schoology.com/v1").replace(/\/$/, ""),
  extensionStoreUrl: process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || "https://chromewebstore.google.com/detail/klar-for-schoology/lfdkiindbipcfalgglcneenkephcphil",
  allowSignups: process.env.KLAR_ALLOW_SIGNUPS !== "false",
};

/** The optional official-API connection needs a consumer key and a key to encrypt stored tokens. */
export const officialApiConfigured = Boolean(env.schoologyKey && env.schoologySecret && env.tokenKey);

/** Ask Klar runs through Vercel AI Gateway: an API key locally, or OIDC on Vercel. */
export const assistantConfigured = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
