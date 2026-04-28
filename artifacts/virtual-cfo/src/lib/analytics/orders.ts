import { supabase } from "../supabase";

export async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*");

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return data;
}