import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { urls } from "../shared/schema";
import pg from "pg";
const { Pool } = pg;

// Script to add multi-destination URL fields to the database
async function addMultiDestinationFields() {
  // Create a PostgreSQL connection
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log("Adding multi-destination URL fields to the database...");

    // Check if the is_multi_destination column already exists
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='urls' AND column_name='is_multi_destination'
    `);

    if (checkResult.rows.length === 0) {
      // Add the is_multi_destination column
      await db.execute(sql`
        ALTER TABLE urls
        ADD COLUMN is_multi_destination BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log("Added is_multi_destination column to urls table");
    } else {
      console.log("is_multi_destination column already exists, skipping...");
    }

    // Check if the destinations column already exists
    const checkDestinationsResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='urls' AND column_name='destinations'
    `);

    if (checkDestinationsResult.rows.length === 0) {
      // Add the destinations column
      await db.execute(sql`
        ALTER TABLE urls
        ADD COLUMN destinations JSONB NOT NULL DEFAULT '{"ios":"","android":"","desktop":""}'::jsonb
      `);
      console.log("Added destinations column to urls table");
    } else {
      console.log("destinations column already exists, skipping...");
    }

    console.log("Database migration completed successfully!");
  } catch (error) {
    console.error("Database migration failed:", error);
  } finally {
    await pool.end();
  }
}

addMultiDestinationFields();