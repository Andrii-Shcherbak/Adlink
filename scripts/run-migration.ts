import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addUserTypeFields() {
  console.log("Adding user type fields to users table");
  
  try {
    // Check if the columns already exist
    const checkColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('user_type')
    `);
    
    const columnNames = checkColumns.rows.map(row => row.column_name);
    
    if (!columnNames.includes('user_type')) {
      console.log("Adding user_type column");
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN user_type TEXT NOT NULL DEFAULT 'external'
      `);
      console.log("user_type column added");
    } else {
      console.log("user_type column already exists");
    }
    
    // Update existing users who have a microsoftId to be internal users
    console.log("Updating existing Microsoft users to internal type");
    await db.execute(sql`
      UPDATE users
      SET user_type = 'internal'
      WHERE microsoft_id IS NOT NULL
    `);
    
    // Make username and password nullable
    console.log("Checking constraints on username and password columns");
    const constraints = await db.execute(sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('username', 'password')
    `);
    
    for (const row of constraints.rows) {
      if (row.is_nullable === 'NO') {
        console.log(`Making ${row.column_name} nullable`);
        await db.execute(sql`
          ALTER TABLE users
          ALTER COLUMN ${sql.identifier(row.column_name)} DROP NOT NULL
        `);
        console.log(`${row.column_name} is now nullable`);
      } else {
        console.log(`${row.column_name} is already nullable`);
      }
    }
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migrations
addUserTypeFields();