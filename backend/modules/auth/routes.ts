import type { FastifyInstance } from "fastify";
import { loginSchema, refreshSchema } from "./schema";
import { loginHandler, refreshHandler } from "./handler";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", { schema: loginSchema }, loginHandler);
  app.post("/refresh", { schema: refreshSchema }, refreshHandler);
}
