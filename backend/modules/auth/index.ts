import type { FastifyInstance } from "fastify";
import { authRoutes } from "./routes";

export async function authModule(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "" });
}
