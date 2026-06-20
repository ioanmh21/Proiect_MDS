const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.ksuqqrirjthczkwmlnup:Q68su1F2bQ97zbXY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres', ssl: { rejectUnauthorized: false } });
client.connect()
  .then(() => client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'study_sessions'"))
  .then(res => { console.log(res.rows); client.end(); })
  .catch(console.error);
