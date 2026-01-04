'use server';

import { createClient } from "@/lib/supabase/server";
import { updateSystemConfig } from "@/lib/config-helper";
import { revalidatePath } from "next/cache";

export async function updateConfigAction(key: string, value: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Unauthorized" };
    }

    // Check admin level
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_level")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_level < 10) {
      return { error: "Forbidden: Admin access required" };
    }

    await updateSystemConfig(key, value, user.id);
    
    revalidatePath("/admin/config");
    return { success: true };
  } catch (error: any) {
    console.error("Config update error:", error);
    return { error: error.message || "Failed to update config" };
  }
}
