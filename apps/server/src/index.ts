import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = 3000;
const app = createApp();

console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
