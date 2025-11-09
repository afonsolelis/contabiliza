const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;

const poolConfig = databaseUrl
  ? { connectionString: databaseUrl, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'contabiliza'
    };

if (process.env.PGPASSWORD !== undefined) {
  poolConfig.password = String(process.env.PGPASSWORD);
}

const pool = new Pool(poolConfig);

function loadSql(relativePath) {
  const absolute = path.join(__dirname, '..', 'models', relativePath);
  return fs.readFileSync(absolute, 'utf8');
}

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, loadSql };


