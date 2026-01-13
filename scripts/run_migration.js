const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('=== Running Migration for Daily Predictions ===\n');
  
  // 1. Check if table exists (simple check by trying to select)
  const { error: tableError } = await supabase.from('daily_predictions').select('id').limit(1);
  if (tableError && tableError.code === '42P01') { // undefined_table
      console.log('❌ daily_predictions table does not exist.');
      console.log('   Please run sql/create_daily_predictions_table.sql in Supabase SQL Editor.');
      return;
  }
  
  console.log('3. Migrating existing points (JS implementation)...');
  
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, chart_config');
    
  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }
  
  let migratedCount = 0;
  
  for (const post of posts || []) {
    if (post.chart_config && post.chart_config.prediction_points && Array.isArray(post.chart_config.prediction_points)) {
      const points = post.chart_config.prediction_points;
      
      for (const point of points) {
        let dateStr;
        if (typeof point.time === 'number') {
          dateStr = new Date(point.time * 1000).toISOString().split('T')[0];
        } else if (typeof point.time === 'string') {
          dateStr = point.time;
        } else {
          continue;
        }
        
        // Insert and ignore conflicts
        const { error: insertError } = await supabase
          .from('daily_predictions')
          .upsert({
            post_id: post.id,
            prediction_date: dateStr,
            predicted_price: point.value
          }, { onConflict: 'post_id, prediction_date' });
          
        if (!insertError) {
          migratedCount++;
        }
      }
    }
  }
  
  console.log(`✅ Migrated ${migratedCount} prediction points.`);
  
  // 3. Trigger Calculation
  console.log('4. Triggering initial calculation...');
  const { error: calcError } = await supabase.rpc('calculate_daily_accuracies');
  
  if (calcError) {
    console.error('Error triggering calculation:', calcError);
    console.log('Please ensure calculate_daily_accuracies function is created in Supabase.');
  } else {
    console.log('✅ Daily accuracies calculated.');
  }
}

runMigration();
