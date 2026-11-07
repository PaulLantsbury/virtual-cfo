import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import opportunitiesRouter from "./opportunities";
import {createDeploymentVersionRouter} from './deployment-version.ts';

const router: IRouter = Router();

router.use(healthRouter);
router.use(createDeploymentVersionRouter());
router.use("/dashboard", dashboardRouter);
router.use("/opportunities", opportunitiesRouter);

export default router;
