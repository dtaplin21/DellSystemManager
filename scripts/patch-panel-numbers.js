const { db } = require('../backend/db');
const { panels } = require('../backend/db/schema');
const { eq } = require('drizzle-orm');

async function patchPanelNumbers() {
  try {
    console.log('🔍 Starting panel number patch...');
    
    // Get all panel layouts
    const allLayouts = await db.select().from(panels);
    console.log(`🔍 Found ${allLayouts.length} panel layouts to process`);
    
    let totalPanelsUpdated = 0;
    let totalLayoutsUpdated = 0;
    
    for (const layout of allLayouts) {
      try {
        // Parse the panels JSON
        const panelsArray = JSON.parse(layout.panels || '[]');
        console.log(`🔍 Processing layout ${layout.id} with ${panelsArray.length} panels`);
        
        let layoutNeedsUpdate = false;
        const updatedPanels = panelsArray.map((panel, index) => {
          let needsUpdate = false;
          const updatedPanel = { ...panel };
          
          // Generate real panel number if it's "N/A"
          if (!panel.panel_number || panel.panel_number === 'N/A') {
            updatedPanel.panel_number = `P${String(index + 1).padStart(3, '0')}`;
            needsUpdate = true;
            console.log(`  📝 Panel ${index + 1}: panel_number updated to ${updatedPanel.panel_number}`);
          }
          
          // Generate real roll number if it's "N/A"
          if (!panel.roll_number || panel.roll_number === 'N/A') {
            updatedPanel.roll_number = `R${String(index + 1).padStart(3, '0')}`;
            needsUpdate = true;
            console.log(`  📝 Panel ${index + 1}: roll_number updated to ${updatedPanel.roll_number}`);
          }
          
          if (needsUpdate) {
            totalPanelsUpdated++;
            layoutNeedsUpdate = true;
          }
          
          return updatedPanel;
        });
        
        // Update the layout if any panels were changed
        if (layoutNeedsUpdate) {
          await db
            .update(panels)
            .set({
              panels: JSON.stringify(updatedPanels),
              lastUpdated: new Date()
            })
            .where(eq(panels.id, layout.id));
          
          totalLayoutsUpdated++;
          console.log(`✅ Updated layout ${layout.id}`);
        } else {
          console.log(`ℹ️  Layout ${layout.id} already has proper panel numbers`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing layout ${layout.id}:`, error);
      }
    }
    
    console.log('\n🎉 Panel number patch completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total layouts processed: ${allLayouts.length}`);
    console.log(`   - Layouts updated: ${totalLayoutsUpdated}`);
    console.log(`   - Individual panels updated: ${totalPanelsUpdated}`);
    
  } catch (error) {
    console.error('❌ Error in patchPanelNumbers:', error);
  } finally {
    process.exit(0);
  }
}

// Run the patch
patchPanelNumbers(); 