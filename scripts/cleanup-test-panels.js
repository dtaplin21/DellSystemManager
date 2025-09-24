#!/usr/bin/env node

/**
 * One-time script to clean up test panels from the database
 * This removes panels that were created by the old ControlToolbar system
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupTestPanels() {
  try {
    console.log('🧹 Starting test panel cleanup...');
    
    // Get all panel layouts
    const { data: layouts, error: fetchError } = await supabase
      .from('panel_layouts')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching layouts:', fetchError);
      return;
    }
    
    console.log(`📊 Found ${layouts.length} panel layouts`);
    
    let totalCleaned = 0;
    
    for (const layout of layouts) {
      if (!layout.panels) continue;
      
      let panels;
      try {
        panels = typeof layout.panels === 'string' ? JSON.parse(layout.panels) : layout.panels;
      } catch (error) {
        console.error(`❌ Error parsing panels for layout ${layout.id}:`, error);
        continue;
      }
      
      if (!Array.isArray(panels)) continue;
      
      const originalCount = panels.length;
      
      // Filter out test panels
      const cleanedPanels = panels.filter(panel => {
        const isTestPanel = 
          (panel.panelNumber && panel.panelNumber.includes('TEST')) ||
          (panel.id && panel.id.includes('test-panel')) ||
          (panel.id && panel.id.includes('panel-69fc302b-166d-4543-9990-89c4b1e0ed59')) ||
          (panel.color === '#00ff00') ||
          (panel.fill === '#00ff00');
        
        if (isTestPanel) {
          console.log(`🗑️ Removing test panel:`, {
            id: panel.id,
            panelNumber: panel.panelNumber,
            color: panel.color,
            fill: panel.fill
          });
        }
        
        return !isTestPanel;
      });
      
      const cleanedCount = originalCount - cleanedPanels.length;
      
      if (cleanedCount > 0) {
        console.log(`🧹 Layout ${layout.id}: Removed ${cleanedCount} test panels (${originalCount} → ${cleanedPanels.length})`);
        
        // Update the layout
        const { error: updateError } = await supabase
          .from('panel_layouts')
          .update({
            panels: JSON.stringify(cleanedPanels),
            last_updated: new Date().toISOString()
          })
          .eq('id', layout.id);
        
        if (updateError) {
          console.error(`❌ Error updating layout ${layout.id}:`, updateError);
        } else {
          totalCleaned += cleanedCount;
        }
      }
    }
    
    console.log(`✅ Cleanup complete! Removed ${totalCleaned} test panels total`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupTestPanels();