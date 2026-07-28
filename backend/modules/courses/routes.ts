import type { FastifyInstance } from "fastify";
import { coursesSchema } from "./schema";
import { coursesHandler } from "./handler";

export async function coursesRoutes(app: FastifyInstance) {
  app.post("/courses", { schema: coursesSchema }, coursesHandler);
}
