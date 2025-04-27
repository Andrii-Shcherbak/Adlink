import { pool } from '../server/db';
import { assetFolders, assetFiles } from '../shared/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function addDigitalAssetsSchema() {
  console.log('Starting migration to add digital assets schema...');
  const db = drizzle(pool);

  try {
    // Create asset folders table
    await db.execute(`
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

    // Create asset files table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_files (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        folder_id INTEGER,
        name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        description TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Add foreign key constraints
    await db.execute(`
      ALTER TABLE asset_folders 
      ADD CONSTRAINT fk_asset_folders_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE asset_folders 
      ADD CONSTRAINT fk_asset_folders_parent 
      FOREIGN KEY (parent_id) REFERENCES asset_folders(id) ON DELETE CASCADE;

      ALTER TABLE asset_files 
      ADD CONSTRAINT fk_asset_files_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE asset_files 
      ADD CONSTRAINT fk_asset_files_folder 
      FOREIGN KEY (folder_id) REFERENCES asset_folders(id) ON DELETE SET NULL;
    `);

    // Add indexes for performance
    await db.execute(`
      CREATE INDEX idx_asset_folders_user_id ON asset_folders(user_id);
      CREATE INDEX idx_asset_folders_parent_id ON asset_folders(parent_id);
      CREATE INDEX idx_asset_files_user_id ON asset_files(user_id);
      CREATE INDEX idx_asset_files_folder_id ON asset_files(folder_id);
    `);

    console.log('Successfully created digital assets schema!');

    // Create a root folder for each existing user
    const users = await db.execute<{ id: number, username: string, email: string }[]>(
      `SELECT id, username, email FROM users WHERE is_active = true`
    );

    for (const user of users.rows) {
      const existingRoot = await db.execute<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM asset_folders WHERE user_id = $1 AND parent_id IS NULL`,
        [user.id]
      );

      if (parseInt(existingRoot.rows[0].count.toString()) === 0) {
        await db.execute(
          `INSERT INTO asset_folders (user_id, name, path) VALUES ($1, $2, $3)`,
          [user.id, 'Root', '/']
        );
        console.log(`Created root folder for user: ${user.email || user.username}`);
      }
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
addDigitalAssetsSchema()
  .then(() => {
    console.log('Digital Assets schema successfully added');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error adding digital assets schema:', err);
    process.exit(1);
  });