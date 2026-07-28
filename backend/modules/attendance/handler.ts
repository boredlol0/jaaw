import type { FastifyRequest, FastifyReply } from "fastify";
import type { FromSchema } from "json-schema-to-ts";
import { authBodySchema } from "../../shared/schemas";
import { loadAttendanceHtml } from "../../shared/loader";
import { AttendanceParser } from "../../shared/parsers/attendance-parser";

type Body = FromSchema<typeof authBodySchema>;

export async function attendanceHandler(
  request: FastifyRequest<{ Body: Body }>,
  reply: FastifyReply,
) {
  const result = await loadAttendanceHtml(request.body);
  return reply.send({
    success: true,
    attendance: AttendanceParser.extract(result.attendanceHtml),
    session: { cookies: result.client.sessionManager.getCookieObject() },
    metadata: result.metadata,
  });
}
