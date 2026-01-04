import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllSystemConfigs } from "@/lib/config-helper";
import { ConfigManager } from "./ConfigManager";

export const metadata = {
  title: "System Config | Admin",
};

export default async function AdminConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check admin level
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_level")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_level < 10) {
    redirect("/");
  }

  // Fetch configs
  const configs = await getAllSystemConfigs();

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Manage dynamic system settings such as API keys and feature flags.
        </p>
      </div>

      <ConfigManager initialConfigs={configs || []} />
    </div>
  );
}
