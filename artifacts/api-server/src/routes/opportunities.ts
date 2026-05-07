import { Router, type IRouter } from "express";

const router: IRouter = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://futkktdebdygsdrcknpr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

router.get("/", async (req, res) => {
  const storeId = (req.query.store_id as string) ?? "10000000-0000-0000-0000-000000000001";

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" });
    return;
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/opportunity_breakdown`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_store_id: storeId }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    req.log.error({ status: response.status, body: text }, "opportunity_breakdown RPC failed");
    res.status(502).json({ error: "Failed to fetch opportunities from Supabase" });
    return;
  }

  const data = await response.json();
  res.json(data);
});

export default router;
