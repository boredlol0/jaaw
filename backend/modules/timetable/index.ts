import type { FastifyInstance } from "fastify";
import { timetableRoutes } from "./routes";

export async function timetableModule(app: FastifyInstance) {
  app.register(timetableRoutes, { prefix: "" });
}
