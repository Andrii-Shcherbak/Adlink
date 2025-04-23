/**
 * Utility functions for application configuration
 */

/**
 * Get the domain for the application based on environment
 * This is used for Microsoft authentication callbacks
 */
export function getAuthDomain(): string {
  // Use AUTH_DOMAIN if set (for production or specific environments)
  if (process.env.AUTH_DOMAIN) {
    console.log("Using AUTH_DOMAIN from env:", process.env.AUTH_DOMAIN);
    return process.env.AUTH_DOMAIN;
  }
  
  // Fallback for development
  console.log("AUTH_DOMAIN not found in environment, using fallback localhost");
  return 'http://localhost:5000';
}