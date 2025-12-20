import { createClient } from "@/lib/supabase/client";
import { checkAccessLevel, checkViewLimit, checkWriteLimit, incrementViewCount, incrementWriteCount } from "@/lib/api/subscription";

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
  accuracy_score?: number;
  // Relations
  profiles?: {
    nickname: string;
    avatar_url?: string;
  };
  // Calculated fields (not in DB)
  currentPrice?: number;
  profitPercentage?: number;
}

export type PostSortOption = 'latest' | 'accuracy' | 'views' | 'accuracy_1day' | 'accuracy_5day' | 'accuracy_10day' | 'completed' | 'recent_accuracy';

export async function fetchPosts(limit: number = 20, offset: number = 0, sort: PostSortOption = 'latest'): Promise<Post[]> {
  const supabase = createClient();
  
  // Handle RPC-based Advanced Sorting
  if (sort === 'accuracy_1day' || sort === 'accuracy_5day' || sort === 'accuracy_10day') {
    const days = sort === 'accuracy_1day' ? 1 : sort === 'accuracy_5day' ? 5 : 10;
    
    // 1. Call RPC to get ranked IDs
    const { data: rankedPosts, error: rpcError } = await supabase
      .rpc('get_posts_by_accuracy_days', { p_days: days, p_limit: limit + offset }); // Fetch slightly more to handle offset
      
    if (rpcError) {
      console.error(`Error calling RPC for ${sort}:`, rpcError);
      return [];
    }
    
    if (!rankedPosts || rankedPosts.length === 0) return [];

    // Slice for pagination (since we fetched 0 to limit+offset)
    const pageIds = rankedPosts.slice(offset, offset + limit).map((p: any) => p.id);
    
    if (pageIds.length === 0) return [];

    // 2. Fetch full details for these IDs
    const { data: fullPosts, error: fetchError } = await supabase
      .from("posts")
      .select(`
        *,
        profiles:user_id (
          nickname,
          avatar_url
        )
      `)
      .in('id', pageIds);

    if (fetchError) {
        console.error("Error fetching full post details:", fetchError);
        return [];
    }

    // 3. Re-sort to match RPC order (Postgres 'IN' does not guarantee order)
    const posts = fullPosts || [];
    const sortedDetails = pageIds.map((id: string) => posts.find((p: any) => p.id === id)).filter((p: any): p is Post => !!p);
    return sortedDetails;
  }

  // Standard Sorting
  let query = supabase
    .from("posts")
    .select(`
      *,
      profiles:user_id (
        nickname,
        avatar_url
      )
    `);

  switch (sort) {
    case 'accuracy':
      query = query.order("accuracy_score", { ascending: false, nullsFirst: false });
      break;
    case 'recent_accuracy':
      // weight accuracy by recency (simple implementation: accuracy * (1 / days_old)) ?
      // or just filter for recent posts (last 30 days) and sort by accuracy?
      // Let's do: Sort by accuracy, but filter created_at > 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("accuracy_score", { ascending: false, nullsFirst: false });
      break;
    case 'views':
      query = query.order("view_count", { ascending: false });
      break;
    case 'completed':
      // Sort by target_date desc, filter where status is NOT WAITING
      query = query
        .neq("prediction_status", "WAITING")
        .order("target_date", { ascending: false, nullsFirst: false }); // most recently completed first
      break;
    case 'latest':
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

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
    // ... (omitted for brevity, keep existing code) ...
    const { error: createError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || "",
        nickname: user.user_metadata?.nickname || user.email?.split('@')[0] || `User_${user.id.substring(0, 8)}`,
      });

    if (createError) {
       // ...
       throw new Error("Failed to create user profile. Please contact support.");
    }
  }

  // Check Subscription Limits (Write)
  await checkWriteLimit(user.id);


  // Auto-register Asset if not exists (To satisfy Foreign Key)
  if (postData.ticker_symbol) {
    let assetType = 'UNKNOWN';
    let isActive = true; // Use true since user is tracking it

    try {
        // Call our own API to identify the asset
        // Note: Using relative URL since this runs in browser
        const response = await fetch(`/api/assets/identify?symbol=${postData.ticker_symbol}`);
        if (response.ok) {
            const result = await response.json();
            if (result.valid) {
                assetType = result.asset_type;
            }
        }
    } catch (e) {
        console.warn("Failed to identify asset type, defaulting to UNKNOWN", e);
    }

    const { error: assetError } = await supabase
      .from('assets')
      .upsert(
        { 
          symbol: postData.ticker_symbol, 
          // Only update api_id if it's missing or we want to enforce it? 
          // Let's keep it simple.
          api_id: postData.ticker_symbol, 
          asset_type: assetType, 
          is_active: isActive 
        },
        { onConflict: 'symbol' } // Removed ignoreDuplicates: true to allow updating is_active
      );
      
    if (assetError) {
      console.error("Warning: Failed to auto-register asset:", assetError);
      // We continue, but insert might fail if it really didn't exist
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

  // Increment Usage Count
  await incrementWriteCount(user.id);

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

  // Increment post view count (public metric)
  await supabase
    .from("posts")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", id);
  
  // Subscription Checks for Viewer (if logged in)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    if (user.id !== data.user_id) { // Don't limit the author viewing their own post
        try {
            // 1. Check Access Level (e.g. Premium Content)
            if (data.required_level > 0) {
               await checkAccessLevel(user.id, data.required_level);
            }
            
            // 2. Check View Limit
            await checkViewLimit(user.id);
            
            // 3. Increment View Usage
            // We do this non-blockingly or blockingly?
            // To ensure strict enforcement, we should await.
            await incrementViewCount(user.id);
        } catch (e: any) {
            console.error("Subscription limit reached:", e.message);
            // Optionally we can return null, or a special "Blocked" object, or throw.
            // Throwing is easiest to handle in the UI (error boundary or try/catch).
            throw e; 
        }
    }
  }

  return data;
}
