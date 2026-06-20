const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.ksuqqrirjthczkwmlnup:Q68su1F2bQ97zbXY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres', ssl: { rejectUnauthorized: false } });

async function backfill() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT t.id, t.student_id, t.material_id, t.feedback, m.title, t.created_at
      FROM test_results t 
      JOIN materials m ON t.material_id = m.id
      WHERE t.status = 'completed'
    `);
    
    console.log(`Found ${res.rows.length} completed tests.`);
    
    for (const row of res.rows) {
      // Update weak concepts
      const feedback = row.feedback;
      if (feedback && feedback.feedback_intrebari) {
        let gresite = 0;
        feedback.feedback_intrebari.forEach(f => {
          if (!f.este_corect) gresite++;
        });
        
        if (gresite > 0) {
          const errorRate = Math.round((gresite / feedback.feedback_intrebari.length) * 100);
          const conceptName = row.title;
          
          const profileRes = await client.query(`SELECT weak_concepts FROM student_profiles WHERE id = $1`, [row.student_id]);
          let weak_concepts = [];
          let exists = profileRes.rows.length > 0;
          if (exists && profileRes.rows[0].weak_concepts) {
            weak_concepts = profileRes.rows[0].weak_concepts;
          }
          
          const existing = weak_concepts.find(c => c.concept === conceptName);
          if (existing) {
            existing.errorRate = Math.round((existing.errorRate + errorRate) / 2);
          } else {
            weak_concepts.push({ concept: conceptName, errorRate });
          }
          
          if (exists) {
            await client.query(`UPDATE student_profiles SET weak_concepts = $1 WHERE id = $2`, [JSON.stringify(weak_concepts), row.student_id]);
          } else {
             await client.query(`INSERT INTO student_profiles (id, student_id, weak_concepts) VALUES ($1, $1, $2)`, [row.student_id, JSON.stringify(weak_concepts)]);
             exists = true; // For next iteration of the loop if same student
          }
        }
      }
    }
    
    const verify = await client.query('SELECT * FROM student_profiles');
    console.log("student_profiles rows:", verify.rows.length);
    console.log("Backfill completed.");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

backfill();
