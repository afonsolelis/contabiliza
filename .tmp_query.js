// Helper temporário: roda SQL arbitrário via o pool do pg, lendo DATABASE_URL do .env.
// Uso: node .tmp_query.js "SELECT 1 AS ok, now();"
require('dotenv').config();
const { Pool } = require('pg');

const sql = process.argv[2];
if (!sql) {
  console.error('Uso: node .tmp_query.js "<SQL>"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    const res = await pool.query(sql);
    if (Array.isArray(res)) {
      res.forEach((r) => console.table(r.rows));
    } else {
      console.table(res.rows);
      console.error(`(${res.rowCount} linha(s))`);
    }
  } catch (err) {
    console.error('ERRO:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
