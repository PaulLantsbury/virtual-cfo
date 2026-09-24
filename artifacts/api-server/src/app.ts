import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import {createFinancialReviewRouter, type ReviewService} from "./routes/financial-reviews";
import { logger } from "./lib/logger";
import {xeroOAuthRuntime} from './lib/xero-oauth';
import {createXeroRouter} from './routes/xero';
import {createXeroStagingBootstrapRouter, type XeroBootstrapRouterDependencies} from './routes/xero-staging-bootstrap';
import {mountStagingSpa} from './lib/mount-staging-spa.ts';

export function createApp(reviewService?: ReviewService, xeroBootstrap?: XeroBootstrapRouterDependencies, webRoot?:string): Express {
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
app.use('/api/xero/staging',createXeroStagingBootstrapRouter(xeroBootstrap));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/xero',createXeroRouter(xeroOAuthRuntime(process.env)));

app.use("/api", router);

// Keep the staging callback and authenticated Settings UI on one exact origin.
// API paths are mounted first and can never fall through to the SPA.
if(webRoot)mountStagingSpa(app,webRoot);

return app;
}

export default createApp();
