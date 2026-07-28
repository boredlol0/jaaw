import type { FastifyInstance } from "fastify";
import { HttpError } from "../shared/errors";

export async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ detail: error.detail });
    }

    if (error instanceof TypeError) {
      return reply.code(503).send({ detail: "Academia server is unreachable. Please try again later." });
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    return reply.code(500).send({ detail: message });
  });
}
