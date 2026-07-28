import type { FastifyInstance } from "fastify";
import { calendarSchema } from "./schema";
import { calendarHandler } from "./handler";

export async function calendarRoutes(app: FastifyInstance) {
  app.post("/calendar", { schema: calendarSchema }, calendarHandler);
}
