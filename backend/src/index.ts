import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { logger } from "./lib/logger";
import pinoHttp from "pino-http";

dotenv.config();

const PORT = process.env.PORT || 8000

const app = express();

//middleware
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/health",
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(cors());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
})