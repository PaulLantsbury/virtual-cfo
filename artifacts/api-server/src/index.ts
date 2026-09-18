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
const localBind=process.env["NIGHT_SCOUT_LOCAL_BIND"];
if(localBind!==undefined&&localBind!=="127.0.0.1"){
  throw new Error('Invalid local bind address');
}

const runtime = await startReviewRuntime(process.env).catch(() => {
  logger.error("Financial review configuration failed; server startup stopped");
  process.exit(1);
});
const app=createApp(runtime?.service);
const server=app.listen(port, localBind, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

for(const signal of ["SIGTERM","SIGINT"] as const){
 process.once(signal,()=>{server.close(()=>{void runtime?.close().finally(()=>process.exit(0));if(!runtime)process.exit(0);});});
}
