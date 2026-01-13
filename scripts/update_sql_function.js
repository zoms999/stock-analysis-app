const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateSQLFunction() {
  console.log('=== Updating SQL Function ===\n');
  
  // Read the SQL file
  const sqlContent = fs.readFileSync(path.join(__dirname, '../sql/calculate_accuracy.sql'), 'utf8');
  
  // Extract just the function definition (skip ALTER TABLE and CREATE INDEX)
  const functionMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION[\s\S]+?END;\s*\$\$ LANGUAGE plpgsql;/);
  
  if (!functionMatch) {
    console.error('Could not find function definition in SQL file');
    return;
  }
  
  const functionSQL = functionMatch[0];
  
  console.log('Executing SQL function update...\n');
  
  const { error } = await supabase.rpc('exec_sql', { sql: functionSQL }).single();
  
  if (error) {
    // Try direct query instead
    const { error: directError } = await supabase.from('_sql').insert({ query: functionSQL });
    
    if (directError) {
      console.error('Error updating function:', error, directError);
      console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
      console.log('---');
      console.log(functionSQL);
      console.log('---');
    } else {
      console.log('✅ Function updated successfully');
    }
  } else {
    console.log('✅ Function updated successfully');
  }
}

updateSQLFunction();
