import { supabase } from "./supabase";

export async function getOrders(limit = 10) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching orders:", error.message);
    return [];
  }

  return data;
}