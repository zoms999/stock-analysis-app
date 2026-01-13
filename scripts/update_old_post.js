const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateOldPost() {
  const postId = 'e2a10f68-5ecb-463d-82af-4d4223663a8d';
  
  console.log('=== Updating Old Post with Prediction Data ===\n');
  
  // Based on the chart image:
  // First point (01.11): 91,466.44
  // Second point (01.14): 91,256.7
  
  const entryPrice = 91466.44;
  const targetPrice = 91256.7;
  const predictionType = targetPrice > entryPrice ? 'LONG' : 'SHORT';
  const targetDate = '2026-01-14'; // Based on chart
  
  console.log('Updating post with:');
  console.log('  Entry Price:', entryPrice);
  console.log('  Target Price:', targetPrice);
  console.log('  Prediction Type:', predictionType);
  console.log('  Target Date:', targetDate);
  console.log('');
  
  const { data, error } = await supabase
    .from('posts')
    .update({
      entry_price: entryPrice,
      target_price: targetPrice,
      prediction_type: predictionType,
      target_date: targetDate,
      prediction_status: 'WAITING'
    })
    .eq('id', postId)
    .select();
  
  if (error) {
    console.error('Error updating post:', error);
    return;
  }
  
  console.log('✅ Post updated successfully');
  console.log('');
  
  // Now run the accuracy calculation
  console.log('Running accuracy calculation...');
  const { error: sqlError } = await supabase.rpc('calculate_and_update_accuracies');
  
  if (sqlError) {
    console.error('Error running SQL function:', sqlError);
  } else {
    console.log('✅ Accuracy calculated');
    
    // Fetch the updated post
    const { data: updatedPost } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
    
    console.log('');
    console.log('Final Post State:');
    console.log('  Entry Price:', updatedPost.entry_price);
    console.log('  Target Price:', updatedPost.target_price);
    console.log('  Prediction Type:', updatedPost.prediction_type);
    console.log('  Accuracy Score:', updatedPost.accuracy_score);
    console.log('  Prediction Status:', updatedPost.prediction_status);
  }
}

updateOldPost();
