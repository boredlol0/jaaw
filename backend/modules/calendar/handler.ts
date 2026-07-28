import type { FastifyRequest, FastifyReply } from "fastify";
import type { FromSchema } from "json-schema-to-ts";
import { authCalendarBodySchema } from "../../shared/schemas";
import { loadCalendarData } from "../../shared/loader";

type Body = FromSchema<typeof authCalendarBodySchema>;

export async function calendarHandler(
  request: FastifyRequest<{ Body: Body }>,
  reply: FastifyReply,
) {
  const result = await loadCalendarData(request.body);
  return reply.send({
    success: true,
    calendar: result.calendar,
    session: { cookies: result.client.sessionManager.getCookieObject() },
    metadata: result.metadata,
  });
}
