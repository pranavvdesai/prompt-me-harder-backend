// db/init.js   ──────────────────────────────────────────
require('dotenv').config();
const fs   = require('fs').promises;
const path = require('path');
const pool = require('./pool');         // pulls connectionString from .env

// Logical schemas we need
const SCHEMAS = ['swiggy', 'zomato', 'magicpin'];

(async () => {
  // load the DDL template with the __SCHEMA__ placeholder
  const ddlTemplate = await fs.readFile(
    path.join(__dirname, '..', 'sql', 'schema.sql'),
    'utf8'
  );

  for (const schema of SCHEMAS) {
    console.log(`🔧  Initialising schema → ${schema}`);

    // 1️⃣  make sure schema exists
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);

    // 2️⃣  replace placeholder and run the DDL
    const ddl = ddlTemplate.replace(/__SCHEMA__/g, schema);
    await pool.query(ddl);
  }

  console.log('✅  All schemas & tables ready on hosted DB');
  await pool.end();
})().catch(err => {
  console.error('❌  init failed', err);
  process.exit(1);
});
