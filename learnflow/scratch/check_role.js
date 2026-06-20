const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function fixEnum() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres.ksuqqrirjthczkwmlnup:Q68su1F2bQ97zbXY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!');

    const { rows } = await client.query(`
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'role';
    `);
    
    console.log('Column info:', rows[0]);

    if (rows[0] && rows[0].data_type === 'USER-DEFINED') {
      const enumName = rows[0].udt_name;
      console.log(`Type is enum: ${enumName}. Altering type to add admin...`);
      await client.query(`ALTER TYPE ${enumName} ADD VALUE IF NOT EXISTS 'admin';`);
      console.log('Admin added to enum!');
    } else {
      console.log('Not an enum, might be something else.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixEnum();
