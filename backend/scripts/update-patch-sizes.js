/**
 * Migration script to update existing patches from 6.67ft radius to 1.5ft radius (3ft diameter)
 * This script should be run once to update existing patch data in the database
 */

const { db } = require('../db/index');
const { panelLayouts } = require('../db/schema');
const { eq } = require('drizzle-orm');

async function updatePatchSizes() {
  console.log('🔄 Starting patch size update...');
  
  try {
    const layouts = await db.select().from(panelLayouts);
    let totalUpdated = 0;
    let layoutsUpdated = 0;
    
    for (const layout of layouts) {
      let patches = [];
      try {
        if (Array.isArray(layout.patches)) {
          patches = layout.patches;
        } else if (typeof layout.patches === 'string') {
          patches = JSON.parse(layout.patches || '[]');
        }
      } catch (error) {
        console.error(`Error parsing patches for layout ${layout.id}:`, error);
        continue;
      }
      
      if (patches.length === 0) {
        continue; // No patches to update
      }
      
      let updated = false;
      const updatedPatches = patches.map(patch => {
        // Update patches with old radius (6.67) to new radius (1.5)
        // Use a small tolerance to catch values like 6.67, 6.666666, etc.
        if (Math.abs(patch.radius - 6.67) < 0.01 || patch.radius === (400 / 30) / 2) {
          updated = true;
          console.log(`  📝 Updating patch ${patch.id || patch.patchNumber || 'unknown'}: ${patch.radius}ft -> 1.5ft`);
          return { ...patch, radius: 1.5 };
        }
        return patch;
      });
      
      if (updated) {
        await db
          .update(panelLayouts)
          .set({
            patches: updatedPatches,
            lastUpdated: new Date()
          })
          .where(eq(panelLayouts.id, layout.id));
        
        const count = updatedPatches.filter(p => p.radius === 1.5).length;
        totalUpdated += count;
        layoutsUpdated++;
        console.log(`✅ Layout ${layout.id}: Updated ${count} patch(es)`);
      }
    }
    
    console.log(`\n✅ Update complete!`);
    console.log(`   - Total patches updated: ${totalUpdated}`);
    console.log(`   - Layouts updated: ${layoutsUpdated}`);
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updatePatchSizes()
    .then(() => {
      console.log('Patch size update script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Patch size update script failed:', error);
      process.exit(1);
    });
}

module.exports = { updatePatchSizes };

