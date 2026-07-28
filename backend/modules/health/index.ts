import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./routes";

export async function healthModule(app: FastifyInstance) {
  app.register(healthRoutes, { prefix: "" });
}
