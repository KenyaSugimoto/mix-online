import { loadServerEnv } from "./env-loader";
import { startRealtimeServer } from "./realtime/server";

loadServerEnv();
const realtimeServer = startRealtimeServer({ port: 3000 });
console.log(`Server is running on http://localhost:${realtimeServer.port}`);
