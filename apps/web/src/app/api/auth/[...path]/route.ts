import { getAuth } from "@/server/neon-auth";

/** Proxies Neon Auth (sessions, sign-in, password reset) on Klar's own origin. */
const handlers = () => getAuth().handler();

export const GET = (...args: Parameters<ReturnType<typeof handlers>["GET"]>) => handlers().GET(...args);
export const POST = (...args: Parameters<ReturnType<typeof handlers>["POST"]>) => handlers().POST(...args);
