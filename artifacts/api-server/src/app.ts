import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import {createFinancialReviewRouter, type ReviewService} from "./routes/financial-reviews";
import { logger } from "./lib/logger";

export function createApp(reviewService?: ReviewService): Express {
const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Mount before general body parsing so review limits and safe errors apply.
app.use("/api/financial-reviews", createFinancialReviewRouter(reviewService));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

return app;
}

export default createApp();
