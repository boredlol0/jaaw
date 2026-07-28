import type { FastifyInstance } from "fastify";
import { marksRoutes } from "./routes";

export async function marksModule(app: FastifyInstance) {
  app.register(marksRoutes, { prefix: "" });
}
