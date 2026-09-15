import {createApp} from "./app";
import {startReviewRuntime} from "./lib/review-startup";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const runtime = await startReviewRuntime(process.env).catch(() => {
  logger.error("Financial review configuration failed; server startup stopped");
  process.exit(1);
});
const app=createApp(runtime?.service);
const server=app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

for(const signal of ["SIGTERM","SIGINT"] as const){
 process.once(signal,()=>{server.close(()=>{void runtime?.close().finally(()=>process.exit(0));if(!runtime)process.exit(0);});});
}
