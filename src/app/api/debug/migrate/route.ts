import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // Use Service Role Key to bypass RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const results: string[] = [];
  let totalMigrated = 0;
  let errors = 0;

  try {
    // 1. Fetch all posts with chart_config
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, title, chart_config');
    
    if (error) {
        results.push(`Fetch Error: ${error.message}`);
        throw error;
    }

    results.push(`Found ${posts?.length || 0} posts to scan.`);

    for (const post of posts || []) {
      if (!post.chart_config) continue;

      // Type assertion for chart_config
      const config = post.chart_config as any;
      const points = config.prediction_points;

      if (points && Array.isArray(points) && points.length > 0) {
        let postMigratedCount = 0;

        for (const point of points) {
          let dateStr: string | null = null;
          
          // Handle various time formats
          if (typeof point.time === 'number') {
            dateStr = new Date(point.time * 1000).toISOString().split('T')[0];
          } else if (typeof point.time === 'string') {
            // Check if it's already YYYY-MM-DD or ISO
            if (point.time.includes('T')) {
                dateStr = point.time.split('T')[0];
            } else {
                dateStr = point.time;
            }
          }

          if (dateStr) {
            // Upsert prediction
            const { error: insertError } = await supabase
              .from('daily_predictions')
              .upsert({
                post_id: post.id,
                prediction_date: dateStr,
                predicted_price: point.value
              }, { onConflict: 'post_id, prediction_date' });

            if (insertError) {
              console.error(`Error migrating post ${post.id}:`, insertError);
              results.push(`Error on post ${post.id}: ${insertError.message} (${insertError.details || insertError.code})`);
              errors++;
            } else {
              postMigratedCount++;
            }
          }
        }

        if (postMigratedCount > 0) {
          totalMigrated += postMigratedCount;
          // results.push(`Migrated ${postMigratedCount} points for post: ${post.title}`);
        }
      }
    }

    results.push(`Total points migrated: ${totalMigrated}`);
    results.push(`Errors encountered: ${errors}`);

    // 2. Trigger calculation
    results.push('Triggering accuracy calculation (v4)...');
    const { error: calcError } = await supabase.rpc('calculate_daily_accuracies_v4');
    
    if (calcError) {
      results.push(`❌ Calculation Error: ${calcError.message}`);
      // Function might not exist
      if (calcError.code === 'PGRST202') {
          results.push('TIP: Please run the SQL in CREATE_V4_FUNCTION.md in Supabase SQL Editor.');
      }
    } else {
      results.push('✅ Calculation completed successfully.');
    }
    
    if (calcError) {
      results.push(`❌ Calculation Error: ${calcError.message}`);
      // Function might not exist
      if (calcError.code === 'PGRST202') {
          results.push('TIP: Please run the SQL in CREATE_V3_FUNCTION.md in Supabase SQL Editor.');
      }
    } else {
      results.push('✅ Calculation completed successfully.');
    }
    
    if (calcError) {
      results.push(`❌ Calculation Error: ${calcError.message}`);
      // Function might not exist
      if (calcError.code === 'PGRST202') {
          results.push('TIP: Please run the SQL in CREATE_V2_FUNCTION.md in Supabase SQL Editor.');
      }
    } else {
      results.push('✅ Calculation completed successfully.');
    }

    return NextResponse.json({
      success: true,
      log: results
    });

  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      log: results
    }, { status: 500 });
  }
}
