/**
 * Populate the panel_layouts entry for a project with synthetic panel data.
 *
 * Usage:
 *   node scripts/populate-panel-layout.js <projectId> [panelCount]
 *
 * Example:
 *   node scripts/populate-panel-layout.js 69fc302b-166d-4543-9990-89c4b1e0ed59 120
 */
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const projectId = process.argv[2];
const panelCount = Number.parseInt(process.argv[3] ?? '120', 10);

if (!projectId) {
  // eslint-disable-next-line no-console
  console.error('❌ Usage: node scripts/populate-panel-layout.js <projectId> [panelCount]');
  process.exit(1);
}

if (Number.isNaN(panelCount) || panelCount <= 0) {
  // eslint-disable-next-line no-console
  console.error('❌ panelCount must be a positive integer');
  process.exit(1);
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Verify the project exists
    const projectResult = await client.query(
      'SELECT id FROM projects WHERE id = $1 LIMIT 1',
      [projectId]
    );

    if (projectResult.rowCount === 0) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Build deterministic layout grid
    const columns = 10;
    const panelWidth = 120; // feet
    const panelHeight = 80; // feet
    const gap = 10; // feet spacing

    const panels = Array.from({ length: panelCount }, (_, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const panelNumber = `P${String(index + 1).padStart(3, '0')}`;

      return {
        id: uuidv4(),
        panelNumber,
        rollNumber: `R${String(index + 1).padStart(3, '0')}`,
        shape: 'rectangle',
        x: col * (panelWidth + gap),
        y: row * (panelHeight + gap),
        width: panelWidth,
        height: panelHeight,
        rotation: 0,
        isValid: true,
        color: '#1d4ed8',
        fill: '#60a5fa',
        date: new Date().toISOString(),
        location: `Grid-${row + 1}-${col + 1}`,
        meta: {
          repairs: [],
          airTest: { result: 'pending' }
        }
      };
    });

    await client.query('DELETE FROM panel_layouts WHERE project_id = $1', [projectId]);

    const layoutId = uuidv4();
    await client.query(
      `
      INSERT INTO panel_layouts (id, project_id, panels, width, height, scale, last_updated)
      VALUES ($1, $2, $3::jsonb, $4, $5, $6, NOW())
      `,
      [
        layoutId,
        projectId,
        JSON.stringify(panels),
        10 * (panelWidth + gap),
        Math.ceil(panelCount / columns) * (panelHeight + gap),
        1.0
      ]
    );

    const verify = await client.query(
      'SELECT jsonb_array_length(panels) AS panel_count FROM panel_layouts WHERE id = $1',
      [layoutId]
    );

    // eslint-disable-next-line no-console
    console.log(`✅ Populated layout ${layoutId} with ${verify.rows[0].panel_count} panels for project ${projectId}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Failed to populate panel layout:', error);
  process.exit(1);
});
