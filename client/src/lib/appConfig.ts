// Utility function to get the current app URL based on environment
export function getAppUrl(): string {
  // For production, return the APP_URL environment variable if it exists
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }
  
  // For Replit deployments
  if (import.meta.env.VITE_REPL_SLUG && import.meta.env.VITE_REPL_OWNER) {
    return `https://${import.meta.env.VITE_REPL_SLUG}.${import.meta.env.VITE_REPL_OWNER}.repl.co`;
  }
  
  // Default to current origin for local development or other environments
  return window.location.origin;
}