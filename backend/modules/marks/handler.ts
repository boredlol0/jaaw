import type { FastifyRequest, FastifyReply } from "fastify";
import type { FromSchema } from "json-schema-to-ts";
import { authBodySchema } from "../../shared/schemas";
import { loadAttendanceHtml } from "../../shared/loader";
import { MarksParser } from "../../shared/parsers/marks-parser";

type Body = FromSchema<typeof authBodySchema>;

export async function marksHandler(
  request: FastifyRequest<{ Body: Body }>,
  reply: FastifyReply,
) {
  const result = await loadAttendanceHtml(request.body);
  return reply.send({
    success: true,
    marks: MarksParser.extract(result.attendanceHtml),
    session: { cookies: result.client.sessionManager.getCookieObject() },
    metadata: result.metadata,
  });
}
