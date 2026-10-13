import type { FastifyInstance } from "fastify";
import { spCaptchaSchema, spLoginSchema, spRefreshSchema } from "./schema";
import { spCaptchaHandler, spDiagHandler, spLoginHandler, spRefreshHandler } from "./handler";

export async function spRoutes(app: FastifyInstance) {
  app.get("/sp/diag", spDiagHandler);
  app.get("/sp/captcha/", { schema: spCaptchaSchema }, spCaptchaHandler);
  app.post("/sp/login", { schema: spLoginSchema }, spLoginHandler);
  app.post("/sp/refresh", { schema: spRefreshSchema }, spRefreshHandler);
}
