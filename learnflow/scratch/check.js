const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.ksuqqrirjthczkwmlnup:Q68su1F2bQ97zbXY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres', ssl: { rejectUnauthorized: false } });
client.connect()
  .then(() => client.query("SELECT id, title, test_config FROM materials WHERE test_config->>'easy' != '3'"))
  .then(res => { console.log("Modified configs:", res.rows); client.end(); })
  .catch(console.error);
