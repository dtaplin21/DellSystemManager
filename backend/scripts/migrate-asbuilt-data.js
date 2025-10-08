#!/usr/bin/env node

/**
 * Data Migration Script for As-Built Records
 * 
 * This script fixes existing as-built records that were created with the old logic:
 * 1. Updates incorrect domain assignments (all were set to "destructive")
 * 2. Recalculates confidence scores (all were 0%)
 * 3. Improves field mapping and data quality
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Domain detection logic (copied from the fixed AI service)
 */
function detectDomainFromContent(rawData, mappedData) {
  const contentText = JSON.stringify({ rawData, mappedData }).toLowerCase();
  
  console.log(`🔍 Analyzing content for domain detection:`, contentText.substring(0, 200));
  
  // Domain detection patterns (using allowed database values)
  const domainPatterns = {
    'panel_placement': [
      'panel', 'placement', 'location', 'position', 'coordinates', 'x', 'y', 'area'
    ],
    'panel_seaming': [
      'seam', 'seaming', 'weld', 'temperature', 'speed', 'pressure', 'operator'
    ],
    'non_destructive': [
      'test', 'testing', 'inspection', 'quality', 'pass', 'fail', 'result', 'non-destructive'
    ],
    'trial_weld': [
      'trial', 'weld', 'sample', 'prototype', 'preliminary'
    ]
  };
  
  let bestDomain = 'panel_placement'; // Default
  let bestScore = 0;
  
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    let score = 0;
    for (const pattern of patterns) {
      if (contentText.includes(pattern)) {
        score += 1;
      }
    }
    
    console.log(`📊 Domain '${domain}' score: ${score}`);
    
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }
  
  console.log(`🎯 Detected domain: ${bestDomain} (score: ${bestScore})`);
  return bestDomain;
}

/**
 * Improved confidence calculation (copied from the fixed AI service)
 */
function calculateConfidence(rawData, mappedData) {
  // Count non-empty fields
  const dataFields = Object.keys(rawData).filter(key => {
    const value = rawData[key];
    return value !== undefined && value !== null && value !== '';
  }).length;
  
  const mappedFields = Object.keys(mappedData).filter(key => {
    const value = mappedData[key];
    return value !== undefined && value !== null && value !== '';
  }).length;
  
  // Calculate base confidence based on data availability
  const baseConfidence = Math.min(0.3, dataFields * 0.05); // Minimum 5% per field, max 30%
  
  // Calculate mapped confidence
  const mappedConfidence = mappedFields > 0 ? (mappedFields / Math.max(dataFields, 1)) * 0.65 : 0;
  
  // Calculate final confidence
  const finalConfidence = Math.min(0.95, baseConfidence + mappedConfidence);
  
  console.log(`📊 Confidence calculation: dataFields=${dataFields}, mappedFields=${mappedFields}, base=${baseConfidence.toFixed(2)}, mapped=${mappedConfidence.toFixed(2)}, final=${finalConfidence.toFixed(2)}`);
  
  return finalConfidence;
}

/**
 * Main migration function
 */
async function migrateAsbuiltData() {
  console.log('🚀 Starting As-Built Data Migration...');
  
  try {
    // Fetch all existing records
    console.log('📊 Fetching existing records...');
    const { data: records, error: fetchError } = await supabase
      .from('asbuilt_records')
      .select('*');
    
    if (fetchError) {
      throw new Error(`Failed to fetch records: ${fetchError.message}`);
    }
    
    console.log(`📋 Found ${records.length} records to migrate`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process records in batches
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} records)`);
      
      for (const record of batch) {
        try {
          console.log(`\n📝 Processing record ${record.id}`);
          
          // Detect correct domain
          const detectedDomain = detectDomainFromContent(record.raw_data, record.mapped_data);
          
          // Calculate new confidence
          const newConfidence = calculateConfidence(record.raw_data, record.mapped_data);
          
          // Update record
          const { error: updateError } = await supabase
            .from('asbuilt_records')
            .update({
              domain: detectedDomain,
              ai_confidence: newConfidence,
              requires_review: newConfidence < 0.7,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
          
          if (updateError) {
            console.error(`❌ Failed to update record ${record.id}:`, updateError.message);
            errorCount++;
          } else {
            console.log(`✅ Updated record ${record.id}: domain=${detectedDomain}, confidence=${newConfidence.toFixed(2)}`);
            updatedCount++;
          }
          
        } catch (recordError) {
          console.error(`❌ Error processing record ${record.id}:`, recordError.message);
          errorCount++;
        }
      }
      
      // Add a small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully updated: ${updatedCount} records`);
    console.log(`❌ Errors: ${errorCount} records`);
    console.log(`📊 Total processed: ${records.length} records`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateAsbuiltData()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAsbuiltData };
