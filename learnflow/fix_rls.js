const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function migrateIngestionJobs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!');

    await client.query(`
      ALTER TABLE ingestion_jobs
        ADD COLUMN IF NOT EXISTS progress_pct     integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS current_step     text,
        ADD COLUMN IF NOT EXISTS error_message    text,
        ADD COLUMN IF NOT EXISTS chunks_total     integer,
        ADD COLUMN IF NOT EXISTS chunks_processed integer;
    `);
    console.log('Columns added to ingestion_jobs!');

    // Check status column constraint - might need to add CHECK constraint
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE ingestion_jobs 
          ADD CONSTRAINT ingestion_jobs_status_check 
          CHECK (status IN ('pending','processing','completed','error'));
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END
      $$;
    `);
    console.log('Status constraint added!');

    const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ingestion_jobs'
      ORDER BY ordinal_position;
    `);
    console.log('Final columns:', rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

migrateIngestionJobs();
