import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173,http://amathint.localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
}

bootstrap();
