import type { FastifyInstance } from "fastify";
import { attendanceRoutes } from "./routes";

export async function attendanceModule(app: FastifyInstance) {
  app.register(attendanceRoutes, { prefix: "" });
}
