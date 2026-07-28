import Fastify from "fastify";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { healthModule } from "./modules/health";
import { authModule } from "./modules/auth";
import { attendanceModule } from "./modules/attendance";
import { marksModule } from "./modules/marks";
import { profileModule } from "./modules/profile";
import { timetableModule } from "./modules/timetable";
import { calendarModule } from "./modules/calendar";
import { coursesModule } from "./modules/courses";
import cors from "@fastify/cors";

export function buildApp() {
  const app = Fastify({ logger: true });


  app.register(cors, {
    origin: "*",
  });

  app.register(errorHandlerPlugin);

  app.register(healthModule);
  app.register(authModule);
  app.register(attendanceModule);
  app.register(marksModule);
  app.register(profileModule);
  app.register(timetableModule);
  app.register(calendarModule);
  app.register(coursesModule);

  return app;
}
