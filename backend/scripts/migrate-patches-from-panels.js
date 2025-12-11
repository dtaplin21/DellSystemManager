/**
 * Migration script to move existing panels with shape: 'patch' to the patches JSONB column
 * This script should be run once to migrate existing patch data
 */

const { db } = require('../db/index');
const { panelLayouts } = require('../db/schema');
const { eq } = require('drizzle-orm');

async function migratePatchesFromPanels() {
  console.log('🔄 Starting migration of patches from panels...');
  
  try {
    // Get all panel layouts
    const layouts = await db.select().from(panelLayouts);
    
    let totalMigrated = 0;
    let totalLayoutsUpdated = 0;
    
    for (const layout of layouts) {
      let panels = [];
      let patches = [];
      
      // Parse panels
      try {
        if (Array.isArray(layout.panels)) {
          panels = layout.panels;
        } else if (typeof layout.panels === 'string') {
          panels = JSON.parse(layout.panels || '[]');
        }
      } catch (error) {
        console.error(`Error parsing panels for layout ${layout.id}:`, error);
        continue;
      }
      
      // Parse existing patches
      try {
        if (Array.isArray(layout.patches)) {
          patches = layout.patches;
        } else if (typeof layout.patches === 'string') {
          patches = JSON.parse(layout.patches || '[]');
        }
      } catch (error) {
        console.error(`Error parsing patches for layout ${layout.id}:`, error);
        patches = [];
      }
      
      // Find panels with shape: 'patch'
      const patchPanels = panels.filter(p => p.shape === 'patch');
      const nonPatchPanels = panels.filter(p => p.shape !== 'patch');
      
      if (patchPanels.length === 0) {
        continue; // No patches to migrate
      }
      
      console.log(`📦 Layout ${layout.id}: Found ${patchPanels.length} patch(es) to migrate`);
      
      // Convert patch panels to Patch format
      const migratedPatches = patchPanels.map(patchPanel => {
        const PATCH_RADIUS = (400 / 30) / 2; // 6.67 feet radius
        return {
          id: patchPanel.id,
          x: patchPanel.x || 0,
          y: patchPanel.y || 0,
          radius: PATCH_RADIUS,
          rotation: patchPanel.rotation || 0,
          isValid: patchPanel.isValid !== false,
          patchNumber: patchPanel.panelNumber || patchPanel.patchNumber || `PATCH-${patchPanel.id.slice(0, 8)}`,
          date: patchPanel.date || new Date().toISOString().slice(0, 10),
          location: patchPanel.location || '',
          notes: patchPanel.notes || '',
          fill: '#ef4444',
          color: '#b91c1c',
          material: patchPanel.material || 'HDPE',
          thickness: patchPanel.thickness || 60,
        };
      });
      
      // Merge with existing patches (avoid duplicates)
      const existingPatchIds = new Set(patches.map(p => p.id));
      const newPatches = migratedPatches.filter(p => !existingPatchIds.has(p.id));
      const allPatches = [...patches, ...newPatches];
      
      // Update layout
      await db
        .update(panelLayouts)
        .set({
          panels: nonPatchPanels,
          patches: allPatches,
          lastUpdated: new Date()
        })
        .where(eq(panelLayouts.id, layout.id));
      
      totalMigrated += newPatches.length;
      totalLayoutsUpdated++;
      
      console.log(`✅ Layout ${layout.id}: Migrated ${newPatches.length} patch(es), kept ${patches.length} existing`);
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   - Total patches migrated: ${totalMigrated}`);
    console.log(`   - Layouts updated: ${totalLayoutsUpdated}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePatchesFromPanels()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePatchesFromPanels };

