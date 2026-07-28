import type { FastifyInstance } from "fastify";
import { attendanceSchema } from "./schema";
import { attendanceHandler } from "./handler";

export async function attendanceRoutes(app: FastifyInstance) {
  app.post("/attendance", { schema: attendanceSchema }, attendanceHandler);
  app.post("/attendence", { schema: attendanceSchema }, attendanceHandler);
}
