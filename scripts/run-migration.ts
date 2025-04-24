import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addInviteFields() {
  console.log("Adding invitation fields to users table");
  
  try {
    // Check if the columns already exist
    const checkColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('invite_token', 'invite_sent_at', 'invite_accepted_at')
    `);
    
    const columnNames = checkColumns.rows.map(row => row.column_name);
    
    if (!columnNames.includes('invite_token')) {
      console.log("Adding invite_token column");
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN invite_token TEXT UNIQUE DEFAULT NULL
      `);
    } else {
      console.log("invite_token column already exists");
    }
    
    if (!columnNames.includes('invite_sent_at')) {
      console.log("Adding invite_sent_at column");
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN invite_sent_at TIMESTAMP DEFAULT NULL
      `);
    } else {
      console.log("invite_sent_at column already exists");
    }
    
    if (!columnNames.includes('invite_accepted_at')) {
      console.log("Adding invite_accepted_at column");
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN invite_accepted_at TIMESTAMP DEFAULT NULL
      `);
    } else {
      console.log("invite_accepted_at column already exists");
    }
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

addInviteFields();