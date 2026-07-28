import { buildApp } from "./app";

const app = buildApp();
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }, (error, address) => {
  if (error) {
    app.log.error(error);
    process.exit(1);
  }

  app.log.info(`Server listening on ${address}`);
});
