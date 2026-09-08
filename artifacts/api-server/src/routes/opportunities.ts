import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Do not proxy a public request with the service role. Restore this endpoint
// only with verified user identity and database-enforced store membership.
router.get("/", (_req, res) => {
  res.status(503).json({ error: "Authenticated store access is not configured" });
});

export default router;
