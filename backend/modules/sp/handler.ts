import type { FastifyRequest, FastifyReply } from "fastify";
import type { FromSchema } from "json-schema-to-ts";
import { spCaptchaSchema, spLoginSchema, spRefreshSchema } from "./schema";
import * as spService from "./service";

type LoginBody = FromSchema<typeof spLoginSchema.body>;
type RefreshBody = FromSchema<typeof spRefreshSchema.body>;

export async function spCaptchaHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await spService.spCaptcha();
  return reply.send({ success: true, ...result });
}

export async function spLoginHandler(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply,
) {
  const result = await spService.spLogin(request.body);
  return reply.send(result);
}

export async function spRefreshHandler(
  request: FastifyRequest<{ Body: RefreshBody }>,
  reply: FastifyReply,
) {
  const result = await spService.spRefresh(request.body.cookies as Record<string, string>);
  return reply.send(result);
}

export type { LoginBody, RefreshBody };
export { spCaptchaSchema };
