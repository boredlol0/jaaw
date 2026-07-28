import type { FastifyRequest, FastifyReply } from "fastify";
import type { FromSchema } from "json-schema-to-ts";
import { credentialsBodySchema, authBodySchema } from "../../shared/schemas";
import * as authService from "./service";

export type LoginCredentials = FromSchema<typeof credentialsBodySchema>;
export type AuthCredentials = FromSchema<typeof authBodySchema>;

export async function loginHandler(
  request: FastifyRequest<{ Body: LoginCredentials }>,
  reply: FastifyReply,
) {
  const result = await authService.login(request.body);
  return reply.send(result);
}

export async function refreshHandler(
  request: FastifyRequest<{ Body: AuthCredentials }>,
  reply: FastifyReply,
) {
  const result = await authService.refresh(request.body);
  return reply.send(result);
}
