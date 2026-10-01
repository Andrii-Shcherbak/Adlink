import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Idle connections dropped by Neon (compute suspend, network blips) are reported here;
// without a listener the 'error' event would crash the process.
pool.on('error', (error) => {
  console.error('Database pool error (idle connection dropped):', error.message);
});

export const db = drizzle({ client: pool, schema });
