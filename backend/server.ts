import { buildApp } from "./app";

const isProd = process.env.NODE_ENV === "production";

const app = buildApp({
  logger:
    isProd ||
    process.env.LOG_PRETTY === "0" ||
    process.env.NODE_ENV === "test"
      ? true
      : {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:HH:MM:ss",
              ignore: "pid,hostname",
              singleLine: true,
            },
          },
        },
});
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }, (error, address) => {
  if (error) {
    app.log.error(error);
    process.exit(1);
  }

  app.log.info(`Server listening on ${address}`);
});
