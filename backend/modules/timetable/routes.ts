import type { FastifyInstance } from "fastify";
import { timetableSchema } from "./schema";
import { timetableHandler } from "./handler";

export async function timetableRoutes(app: FastifyInstance) {
  app.post("/schedule", { schema: timetableSchema }, timetableHandler);
}
