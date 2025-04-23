/**
 * Utility functions for application configuration
 */

/**
 * Get the domain for the application based on environment
 * This is used for Microsoft authentication callbacks
 * 
 * Note: For production deployments, the AUTH_DOMAIN environment variable
 * should be set as a deployment secret with the value:
 * https://adlink.dcxtransform.com
 */
export function getAuthDomain(): string {
  // Use AUTH_DOMAIN if set (for production or specific environments)
  if (process.env.AUTH_DOMAIN) {
    console.log("Using AUTH_DOMAIN from environment:", process.env.AUTH_DOMAIN);
    console.log("Microsoft callback URL will be:", `${process.env.AUTH_DOMAIN}/api/auth/microsoft/callback`);
    return process.env.AUTH_DOMAIN;
  }
  
  // Fallback for local development - this should never happen in production
  console.log("WARNING: AUTH_DOMAIN not found in environment!");
  console.log("Using fallback 'localhost' domain - this won't work with Microsoft auth");
  console.log("For production, set AUTH_DOMAIN='https://adlink.dcxtransform.com' as a deployment secret");
  return 'http://localhost:5000';
}