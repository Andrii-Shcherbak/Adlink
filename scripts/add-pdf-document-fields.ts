import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { urls } from '../shared/schema';
import { boolean, integer, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

dotenv.config();

// Database client setup
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function addPdfDocumentFields() {
  try {
    console.log("Adding PDF document fields to urls table...");
    
    // Check if the columns already exist to avoid errors
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'urls' AND column_name = 'is_pdf_document'
    `);
    
    if (checkResult.length === 0) {
      // Add the new columns
      await db.execute(sql`
        ALTER TABLE urls 
        ADD COLUMN IF NOT EXISTS is_pdf_document BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS pdf_document_url TEXT,
        ADD COLUMN IF NOT EXISTS pdf_document_name TEXT,
        ADD COLUMN IF NOT EXISTS pdf_document_size INTEGER
      `);
      
      console.log("PDF document fields added successfully!");
    } else {
      console.log("PDF document fields already exist, skipping migration.");
    }
  } catch (error) {
    console.error("Error adding PDF document fields:", error);
    throw error;
  } finally {
    await client.end();
  }
}

addPdfDocumentFields()
  .then(() => {
    console.log("Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });