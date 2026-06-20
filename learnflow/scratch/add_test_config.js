const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function addTestConfig() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres.ksuqqrirjthczkwmlnup:Q68su1F2bQ97zbXY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check if column exists
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='materials' AND column_name='test_config'
    `);
    
    if (checkRes.rows.length === 0) {
      await client.query(`
        ALTER TABLE materials 
        ADD COLUMN test_config JSONB DEFAULT '{"easy": 3, "medium": 2, "hard": 1}'::jsonb;
      `);
      console.log('Successfully added test_config column to materials table.');
    } else {
      console.log('test_config column already exists.');
    }

  } catch (err) {
    console.error('Error adding column:', err);
  } finally {
    await client.end();
  }
}

addTestConfig();
