const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function runSql(sql, label) {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log(`[migrate] applied: ${label}`);
  } finally {
    client.release();
  }
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
}

async function runMigrations() {
  const baseInit = path.join(__dirname, '..', 'migrations', 'db_init.sql');
  const baseSql = readIfExists(baseInit);
  if (baseSql) {
    await runSql(baseSql, 'src/migrations/db_init.sql');
  }

  const rootMigrationsDir = path.join(process.cwd(), 'migrations');
  if (fs.existsSync(rootMigrationsDir)) {
    const files = fs
      .readdirSync(rootMigrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      const p = path.join(rootMigrationsDir, f);
      const sql = fs.readFileSync(p, 'utf8');
      await runSql(sql, `migrations/${f}`);
    }
  }
}

module.exports = { runMigrations };

