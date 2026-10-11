import type { FastifyInstance } from "fastify";
import { spRoutes } from "./routes";

export async function spModule(app: FastifyInstance) {
  app.register(spRoutes, { prefix: "" });
}
