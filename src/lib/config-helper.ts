import { createClient } from '@supabase/supabase-js';

// Environment variables for DB connection (must remain in .env)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create a Supabase client with the Service Role key
// This client bypasses RLS, so it should be used carefully
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// In-memory cache
// Key: Config Key, Value: Config Value
let configCache: Record<string, string> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Fetch a system configuration value.
 * Uses in-memory caching to reduce DB hits.
 */
export async function getSystemConfig(key: string): Promise<string> {
  const now = Date.now();

  // Return from cache if valid
  if (configCache && (now - lastCacheTime < CACHE_TTL_MS)) {
    return configCache[key] || '';
  }

  // Fetch all configs from DB
  try {
    const { data, error } = await supabaseAdmin
      .from('system_config')
      .select('key, value');

    if (error) {
      console.error('Failed to fetch system_config:', error);
      // Fallback to empty string or throw, but here we return empty to avoid crashing
      // Ideally should maybe fallback to process.env if critical? 
      // For now, consistent with DB-only source of truth.
      throw error;
    }

    // Update cache
    configCache = (data || []).reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
    
    lastCacheTime = now;

    return configCache[key] || '';
  } catch (err) {
    console.error('Error getting system config:', err);
    return '';
  }
}

/**
 * Update a system configuration value.
 * Only accessible via admin API routes.
 */
export async function updateSystemConfig(key: string, value: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('system_config')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

  if (error) {
    throw new Error(`Failed to update config: ${error.message}`);
  }

  // Invalidate cache
  configCache = null;
}

/**
 * Fetch all system configurations (for Admin UI)
 */
export async function getAllSystemConfigs() {
   const { data, error } = await supabaseAdmin
      .from('system_config')
      .select('*')
      .order('key');
      
    if (error) throw error;
    return data;
}
