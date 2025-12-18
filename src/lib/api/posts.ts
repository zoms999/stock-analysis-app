import { createClient } from "@/lib/supabase/client";

export type PredictionType = "LONG" | "SHORT";
export type PredictionStatus = "WAITING" | "SUCCESS" | "FAIL" | "TIMEOUT";

export interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  ticker_symbol: string;
  chart_config: any;
  chart_image_url?: string;
  required_level: number;
  view_count: number;
  created_at: string;
  // Prediction fields
  prediction_type?: PredictionType;
  entry_price?: number;
  target_price?: number;
  stop_loss_price?: number;
  target_date?: string;
  prediction_status?: PredictionStatus;
  // Relations
  profiles?: {
    nickname: string;
    avatar_url?: string;
  };
  // Calculated fields (not in DB)
  currentPrice?: number;
  profitPercentage?: number;
}

export async function fetchPosts(limit: number = 20, offset: number = 0): Promise<Post[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("posts")
    .select(`
      *,
      profiles:user_id (
        nickname,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }

  return data || [];
}

export interface PostData {
  title: string;
  content: string;
  ticker_symbol: string;
  chart_config: any; // JSONB
  chart_image_url?: string;
  // Prediction fields (optional)
  prediction_type?: PredictionType;
  entry_price?: number;
  target_price?: number;
  stop_loss_price?: number;
  target_date?: string;
}

export async function createPost(postData: PostData) {
  const supabase = createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Check if user profile exists, create if not
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    console.log("Profile not found, creating one for user:", user.id);
    
    // Create profile automatically
    const { error: createError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || "",
        nickname: user.user_metadata?.nickname || user.email?.split('@')[0] || `User_${user.id.substring(0, 8)}`,
      });

    if (createError) {
      console.error("Failed to create profile:", createError);
      throw new Error("Failed to create user profile. Please contact support.");
    }
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title: postData.title,
      content: postData.content,
      ticker_symbol: postData.ticker_symbol,
      chart_config: postData.chart_config,
      chart_image_url: postData.chart_image_url,
      prediction_type: postData.prediction_type,
      entry_price: postData.entry_price,
      target_price: postData.target_price,
      stop_loss_price: postData.stop_loss_price,
      target_date: postData.target_date,
      prediction_status: postData.prediction_type ? "WAITING" : null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating post:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  return data;
}

export async function fetchPostById(id: string): Promise<Post | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("posts")
    .select(`
      *,
      profiles:user_id (
        nickname,
        avatar_url
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching post:", error);
    return null;
  }

  // Increment view count
  await supabase
    .from("posts")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", id);

  return data;
}
