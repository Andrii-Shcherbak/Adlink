/**
 * Utility functions for application configuration
 */

/**
 * Get the base URL for the application based on environment
 * This is used for callbacks, redirects, and any absolute URLs needed by the server
 */
export function getAppBaseUrl(): string {
  // First priority: explicitly set APP_URL
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Second priority: Replit environment (for development and testing)
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }

  // Fallback for local development
  return 'http://localhost:5000';
}