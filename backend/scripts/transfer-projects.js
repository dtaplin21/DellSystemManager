const { pool } = require('../db');
const config = require('../config/env');

async function transferProjects() {
  try {
    console.log('🔍 Finding user IDs...');
    
    // Find dev user ID
    const devUserResult = await pool.query('SELECT id FROM users WHERE email = $1', ['dev@example.com']);
    const devUserId = devUserResult.rows[0]?.id;
    console.log('Dev user ID:', devUserId);
    
    // Find real user ID
    const realUserResult = await pool.query('SELECT id FROM users WHERE email = $1', ['dtaplin21+new@gmail.com']);
    const realUserId = realUserResult.rows[0]?.id;
    console.log('Real user ID:', realUserId);
    
    if (!devUserId) {
      console.log('❌ Dev user not found');
      return;
    }
    
    if (!realUserId) {
      console.log('❌ Real user not found - creating user...');
      // Create the real user
      const createUserResult = await pool.query(
        'INSERT INTO users (id, email, display_name, company, subscription, is_admin, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id',
        ['temp-id-' + Date.now(), 'dtaplin21+new@gmail.com', 'David Taplin', 'Dell System Manager', 'premium', true]
      );
      const newUserId = createUserResult.rows[0].id;
      console.log('✅ Created real user with ID:', newUserId);
      
      // Update projects to use the new user ID
      const updateResult = await pool.query(
        'UPDATE projects SET user_id = $1 WHERE user_id = $2',
        [newUserId, devUserId]
      );
      console.log('✅ Transferred', updateResult.rowCount, 'projects to real user');
    } else {
      // Transfer projects from dev user to real user
      const updateResult = await pool.query(
        'UPDATE projects SET user_id = $1 WHERE user_id = $2',
        [realUserId, devUserId]
      );
      console.log('✅ Transferred', updateResult.rowCount, 'projects to real user');
    }
    
    // Verify the transfer
    const verifyResult = await pool.query('SELECT COUNT(*) as count FROM projects WHERE user_id = $1', [realUserId || 'temp-id-' + Date.now()]);
    console.log('✅ Projects now owned by real user:', verifyResult.rows[0].count);
    
  } catch (error) {
    console.error('❌ Error transferring projects:', error);
  } finally {
    await pool.end();
  }
}

transferProjects();
