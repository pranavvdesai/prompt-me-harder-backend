// db/seed.js
const fs   = require('fs');
const path = require('path');
const pool = require('./pool');           // same pool.js you already use

const SCHEMAS = ['swiggy', 'zomato', 'magicpin'];
const rawSQL  = fs.readFileSync(
  path.join(__dirname, '..', 'sql', 'mock_data.sql'),
  'utf8'
);

(async () => {
  for (const schema of SCHEMAS) {
    console.log(`🌱  Seeding ${schema}`);
    const sql = rawSQL.replace(/__SCHEMA__/g, schema);
    await pool.query(sql);
  }
  console.log('✅  Mock data inserted for all schemas');
  pool.end();
})();
