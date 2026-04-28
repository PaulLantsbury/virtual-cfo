import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .limit(1);

  if (error) {
    console.log("Supabase reachable but table not accessible yet:", error.message);
    return false;
  }

  console.log("Supabase connected successfully:", data);
  return true;
}