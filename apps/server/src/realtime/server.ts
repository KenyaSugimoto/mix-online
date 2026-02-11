import type { Server as HttpServer } from "node:http";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { createApp } from "../app";
import { type SessionStore, createInMemorySessionStore } from "../auth-session";
import { type WsGateway, createWsGateway } from "./ws-gateway";

export type RealtimeServer = {
  app: ReturnType<typeof createApp>;
  sessionStore: SessionStore;
  wsGateway: WsGateway;
  port: number;
  close: () => Promise<void>;
};

type StartRealtimeServerOptions = {
  port?: number;
  sessionStore?: SessionStore;
  now?: () => Date;
};

export const startRealtimeServer = (
  options: StartRealtimeServerOptions = {},
): RealtimeServer => {
  const sessionStore = options.sessionStore ?? createInMemorySessionStore();
  const app = createApp({ sessionStore, now: options.now });
  const wsGateway = createWsGateway({ sessionStore, now: options.now });

  const server = serve({
    fetch: app.fetch,
    port: options.port ?? 3000,
  });

  const wsServer = new WebSocketServer({
    server: server as HttpServer,
    path: "/ws",
  });

  wsServer.on("connection", (socket, request) => {
    wsGateway.handleConnection({ socket, request });
  });

  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 3000;

  return {
    app,
    sessionStore,
    wsGateway,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wsServer.close((wsError) => {
          if (wsError) {
            reject(wsError);
            return;
          }

          server.close((httpError) => {
            if (httpError) {
              reject(httpError);
              return;
            }
            resolve();
          });
        });
      }),
  };
};
