import { supabase } from "../supabase";

export async function getTotalRevenue() {
  const { data, error } = await supabase
    .from("orders")
    .select("total_sales");

  if (error) {
    console.error("Revenue query failed:", error.message);
    return 0;
  }

  return data.reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
}