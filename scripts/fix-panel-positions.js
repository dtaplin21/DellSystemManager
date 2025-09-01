const { Client } = require('pg');

// Fill in your Supabase connection string here (from the Supabase dashboard > Project Settings > Database > Connection string)
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Get all panel layouts
    const layoutsRes = await client.query(
      'SELECT id, project_id, panels FROM panel_layouts WHERE panels IS NOT NULL AND panels != \'[]\''
    );

    console.log(`Found ${layoutsRes.rows.length} panel layouts to check`);

    for (const layout of layoutsRes.rows) {
      let panels;
      try {
        panels = JSON.parse(layout.panels);
      } catch (e) {
        console.error(`Could not parse panels JSON for layout ${layout.id}:`, e);
        continue;
      }

      if (!Array.isArray(panels) || panels.length === 0) {
        continue;
      }

      console.log(`\nChecking layout ${layout.id} (project ${layout.project_id}):`);
      console.log(`  - ${panels.length} panels`);

      // 2. Check for panels with default positions
      const panelsWithDefaults = panels.filter(panel => {
        return (panel.x === 50 && panel.y === 50) || 
               (panel.x === 0 && panel.y === 0) ||
               (Math.abs(panel.x - 50) < 10 && Math.abs(panel.y - 50) < 10);
      });

      if (panelsWithDefaults.length > 0) {
        console.log(`  - Found ${panelsWithDefaults.length} panels with default positions`);
        
        // 3. Fix panel positions by spreading them out
        let changed = false;
        const fixedPanels = panels.map((panel, index) => {
          const isDefaultPosition = (panel.x === 50 && panel.y === 50) || 
                                  (panel.x === 0 && panel.y === 0) ||
                                  (Math.abs(panel.x - 50) < 10 && Math.abs(panel.y - 50) < 10);
          
          if (isDefaultPosition) {
            const newX = index * 300 + 100;
            const newY = 100;
            console.log(`    - Panel ${panel.id}: (${panel.x}, ${panel.y}) -> (${newX}, ${newY})`);
            changed = true;
            return { ...panel, x: newX, y: newY };
          }
          return panel;
        });

        if (changed) {
          // 4. Update the database
          await client.query(
            'UPDATE panel_layouts SET panels = $1 WHERE id = $2',
            [JSON.stringify(fixedPanels), layout.id]
          );
          console.log(`  - Updated layout ${layout.id} with fixed positions`);
        }
      } else {
        console.log(`  - All panels have non-default positions`);
      }
    }

    console.log('\nPanel position fix completed!');
  } catch (error) {
    console.error('Error fixing panel positions:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
