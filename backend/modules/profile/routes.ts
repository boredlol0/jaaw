import type { FastifyInstance } from "fastify";
import { profileSchema } from "./schema";
import { profileHandler } from "./handler";

export async function profileRoutes(app: FastifyInstance) {
  app.post("/profile", { schema: profileSchema }, profileHandler);
}
