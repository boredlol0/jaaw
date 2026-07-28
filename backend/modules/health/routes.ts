import type { FastifyInstance } from "fastify";
import { APP_VERSION } from "../../config";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => "i wonder why you came here");

  app.get("/version", async () => ({ version: APP_VERSION }));

  app.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  }));
}
