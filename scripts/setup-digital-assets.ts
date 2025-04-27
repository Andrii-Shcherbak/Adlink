import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { assetFolders, assetFiles } from '../shared/schema';

async function setupDigitalAssets() {
  console.log('Starting digital assets schema setup...');
  
  try {
    // Create asset_folders table if it doesn't exist
    console.log('Creating asset_folders table if it doesn\'t exist...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS asset_folders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        parent_id INTEGER,
        path TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create asset_files table if it doesn't exist
    console.log('Creating asset_files table if it doesn\'t exist...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS asset_files (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        folder_id INTEGER,
        name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        storage_file_name TEXT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        description TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Digital assets schema setup completed successfully');
  } catch (error) {
    console.error('Error setting up digital assets schema:', error);
    throw error;
  }
}

// Run the setup
setupDigitalAssets()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });