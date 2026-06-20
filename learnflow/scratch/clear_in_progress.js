const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.ksuqqrirjthczkwmlnup:Q68su1F2bQ97zbXY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres', ssl: { rejectUnauthorized: false } });
client.connect()
  .then(() => client.query("DELETE FROM test_results WHERE status = 'in_progress'"))
  .then(res => { console.log(`Deleted ${res.rowCount} in_progress tests.`); client.end(); })
  .catch(console.error);
