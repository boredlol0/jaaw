import type { FastifyInstance } from "fastify";
import { coursesRoutes } from "./routes";

export async function coursesModule(app: FastifyInstance) {
  app.register(coursesRoutes, { prefix: "" });
}
