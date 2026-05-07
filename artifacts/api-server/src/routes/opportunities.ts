import { Router, type IRouter } from "express";

const router: IRouter = Router();

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://futkktdebdygsdrcknpr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Demo store UUID — hardcoded server-side; not derived from the request so
// callers cannot influence which tenant's data is returned.
const DEMO_STORE_ID = "10000000-0000-0000-0000-000000000001";

router.get("/", async (req, res) => {
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
      body: JSON.stringify({ p_store_id: DEMO_STORE_ID }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    req.log.error(
      { status: response.status, body: text },
      "opportunity_breakdown RPC failed",
    );
    res.status(502).json({ error: "Failed to fetch opportunities" });
    return;
  }

  const data = await response.json();
  res.json(data);
});

export default router;
