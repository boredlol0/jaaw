import type { FastifyInstance } from "fastify";
import { calendarRoutes } from "./routes";

export async function calendarModule(app: FastifyInstance) {
  app.register(calendarRoutes, { prefix: "" });
}
