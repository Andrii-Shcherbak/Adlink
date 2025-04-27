import { sql } from 'drizzle-orm';
import { db } from '../server/db';

async function updateAssetFilesSchema() {
  console.log('Starting asset files schema update...');
  
  try {
    // Check if the storage_file_name column exists
    const checkColumnResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'asset_files' 
      AND column_name = 'storage_file_name';
    `);

    // Check if the result is empty (no matching columns found)
    const rows = (checkColumnResult as any).rows || [];
    if (rows.length === 0) {
      console.log('Adding storage_file_name column to asset_files table...');
      
      await db.execute(sql`
        ALTER TABLE asset_files
        ADD COLUMN storage_file_name TEXT NOT NULL DEFAULT '';
      `);
      
      console.log('Successfully added storage_file_name column');
      
      // Update existing records to set storage_file_name from fileUrl
      // Extract filename from the full URL and use it as storage_file_name
      await db.execute(sql`
        UPDATE asset_files
        SET storage_file_name = SUBSTRING(file_url FROM '[^/]+$')
        WHERE storage_file_name = '';
      `);
      
      console.log('Successfully updated existing records with storage_file_name');
    } else {
      console.log('storage_file_name column already exists in asset_files table');
    }
    
    console.log('Asset files schema update completed successfully');
  } catch (error) {
    console.error('Error updating asset files schema:', error);
    throw error;
  }
}

// Run the migration
updateAssetFilesSchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });