const { Client } = require('pg');

// Fill in your Supabase connection string here (from the Supabase dashboard > Project Settings > Database > Connection string)
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

const PROJECT_ID = 'chfdozvsvltdmglcuoqf'; // Replace with your actual project ID

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  // 1. Fetch the panel layout for the project
  const res = await client.query(
    'SELECT id, panels FROM panel_layouts WHERE project_id = $1',
    [PROJECT_ID]
  );

  if (res.rows.length === 0) {
    console.log('No panel layout found for this project.');
    await client.end();
    return;
  }

  const { id, panels } = res.rows[0];
  let panelArray;
  try {
    panelArray = JSON.parse(panels);
  } catch (e) {
    console.error('Could not parse panels JSON:', e);
    await client.end();
    return;
  }

  // 2. Print current panel positions
  console.log('Current panel positions:');
  panelArray.forEach((panel, idx) => {
    console.log(
      `Panel ${idx}: id=${panel.id}, x=${panel.x}, y=${panel.y}, width=${panel.width}, height=${panel.height}`
    );
  });

  // 3. (Optional) Fix: spread out panels horizontally if all are at (0,0)
  let changed = false;
  panelArray.forEach((panel, idx) => {
    if ((panel.x === 0 || panel.x === undefined) && (panel.y === 0 || panel.y === undefined)) {
      panel.x = idx * 300; // Spread out by 300 units
      panel.y = 100;       // Fixed y for demo
      changed = true;
    }
  });

  if (changed) {
    // 4. Update the database
    await client.query(
      'UPDATE panel_layouts SET panels = $1 WHERE id = $2',
      [JSON.stringify(panelArray), id]
    );
    console.log('Panel positions updated!');
  } else {
    console.log('No changes needed.');
  }

  await client.end();
}

main().catch(console.error); 