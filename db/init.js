const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

const SCHEMAS = ['swiggy', 'zomato', 'magicpin'];

async function run() {
  const rawDDL = fs.readFileSync(
    path.join(__dirname, '..', 'sql', 'schema.sql'),
    'utf8'
  );

  for (const schema of SCHEMAS) {
    console.log(`\n🔧  Initialising schema → ${schema}`);

    // 1. create schema if it doesn't exist
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);

    // 2. swap placeholder & execute DDL
    const ddl = rawDDL.replace(/__SCHEMA__/g, schema);
    await pool.query(ddl);
  }

  console.log('\n✅  All schemas ready!');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});