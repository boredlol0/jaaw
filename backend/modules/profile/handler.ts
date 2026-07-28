import type { FastifyRequest, FastifyReply } from "fastify";
import type { FromSchema } from "json-schema-to-ts";
import { authBodySchema } from "../../shared/schemas";
import { loadLoginData } from "../../shared/loader";

type Body = FromSchema<typeof authBodySchema>;

export async function profileHandler(
  request: FastifyRequest<{ Body: Body }>,
  reply: FastifyReply,
) {
  const result = await loadLoginData(request.body);
  return reply.send({
    success: true,
    profile: result.profile,
    session: { cookies: result.client.sessionManager.getCookieObject() },
    metadata: result.metadata,
  });
}
