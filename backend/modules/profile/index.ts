import type { FastifyInstance } from "fastify";
import { profileRoutes } from "./routes";

export async function profileModule(app: FastifyInstance) {
  app.register(profileRoutes, { prefix: "" });
}
