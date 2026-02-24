import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const pools = [
    {
      name: 'eventstore',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'eventstore',
        user: 'admin',
        password: 'secret'
      },
      file: '001_create_events_table.sql'
    },
    {
      name: 'readmodel',
      config: {
        host: 'localhost',
        port: 5433,
        database: 'readmodel',
        user: 'admin',
        password: 'secret'
      },
      file: '002_create_read_model.sql'
    }
  ];

  for (const { name, config, file } of pools) {
    console.log(`🔄 Migrating ${name}...`);
    
    const pool = new Pool(config);
    
    try {
      const sql = fs.readFileSync(
        path.join(__dirname, '..', 'migrations', file),
        'utf8'
      );
      
      await pool.query(sql);
      console.log(`✅ ${name} migrated successfully`);
    } catch (error) {
      console.error(`❌ Error migrating ${name}:`, error);
    } finally {
      await pool.end();
    }
  }
}

migrate().then(() => {
  console.log('🎉 All migrations completed');
  process.exit(0);
}).catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});