const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres.ksuqqrirjthczkwmlnup:Q68su1F2bQ97zbXY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres', ssl: { rejectUnauthorized: false } });
client.connect().then(() => {
  return client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('profiles', 'test_results', 'materials', 'ingestion_jobs') ORDER BY table_name, ordinal_position;");
}).then(res => {
  const schema = {};
  res.rows.forEach(r => {
    if (!schema[r.table_name]) schema[r.table_name] = [];
    schema[r.table_name].push(r.column_name);
  });
  console.log(JSON.stringify(schema, null, 2));
  client.end();
}).catch(console.error);
