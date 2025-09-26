#!/usr/bin/env tsx
/**
 * Background job to detect calendar conflicts
 * Run this periodically to ensure all conflicts are detected
 * 
 * Usage:
 * - npm run detect-conflicts
 * - Or run directly: tsx scripts/detectConflicts.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function detectAllConflicts() {
  console.log('🔍 Starting conflict detection for all households...');
  
  try {
    // Get all households
    const { data: households, error: householdsError } = await supabase
      .from('households')
      .select('id, name');
    
    if (householdsError) {
      throw new Error(`Failed to fetch households: ${householdsError.message}`);
    }
    
    if (!households || households.length === 0) {
      console.log('ℹ️  No households found');
      return;
    }
    
    console.log(`📊 Found ${households.length} households`);
    
    let totalConflicts = 0;
    let processedHouseholds = 0;
    
    // Process each household
    for (const household of households) {
      try {
        console.log(`\n🏠 Processing household: ${household.name} (${household.id})`);
        
        // Run conflict detection for this household
        const { error: detectionError } = await supabase
          .rpc('upsert_calendar_conflicts', { p_household_id: household.id });
        
        if (detectionError) {
          console.error(`❌ Error detecting conflicts for household ${household.id}:`, detectionError);
          continue;
        }
        
        // Count conflicts for this household
        const { data: conflicts, error: conflictsError } = await supabase
          .from('calendar_conflicts')
          .select('id')
          .eq('household_id', household.id)
          .eq('is_resolved', false);
        
        if (conflictsError) {
          console.error(`❌ Error counting conflicts for household ${household.id}:`, conflictsError);
          continue;
        }
        
        const conflictCount = conflicts?.length || 0;
        totalConflicts += conflictCount;
        processedHouseholds++;
        
        if (conflictCount > 0) {
          console.log(`⚠️  Found ${conflictCount} conflicts`);
        } else {
          console.log(`✅ No conflicts found`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing household ${household.id}:`, error);
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   Processed: ${processedHouseholds}/${households.length} households`);
    console.log(`   Total conflicts: ${totalConflicts}`);
    console.log(`✅ Conflict detection completed`);
    
  } catch (error) {
    console.error('❌ Fatal error during conflict detection:', error);
    process.exit(1);
  }
}

// Run the detection
detectAllConflicts()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
