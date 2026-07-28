import type { FastifyInstance } from "fastify";
import { marksSchema } from "./schema";
import { marksHandler } from "./handler";

export async function marksRoutes(app: FastifyInstance) {
  app.post("/marks", { schema: marksSchema }, marksHandler);
}
