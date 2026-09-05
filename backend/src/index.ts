import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { logger } from "./lib/logger";
import pinoHttp from "pino-http";

import authRoutes from "./routes/auth.route";
import restaurantRoute from "./routes/restaurant.route";
import categoryRoute from "./routes/category.routes";
import foodRoute from "./routes/food.routes";

const PORT = process.env.PORT || 8000;

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
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

//API ENDPOINTS
app.use("/api/auth", authRoutes);
app.use("/api/restaurant", restaurantRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/foods", foodRoute);

app.listen(PORT, () => {
  logger.info({ port: PORT }, "server started");
});
