const sql = require('mssql');
// dotenv is loaded by server.js at startup — no need to reload here

const sqlConfig = {
  user: process.env.DB_USER || 'kashafa_app_user',
  password: process.env.DB_PASSWORD || 'Strong_Password_Here_123!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'KashafaDB',
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS',
    encrypt: false,
    trustServerCertificate: true,
  },
};

let pool;
async function getDbPool() {
  if (pool && pool.connected) return pool;
  try {
    pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();
    console.log('✅ Connected to MSSQL Express successfully!');
    return pool;
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    throw err;
  }
}

module.exports = { getDbPool, sql };