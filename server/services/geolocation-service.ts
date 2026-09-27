/**
 * Advanced Geolocation Service
 * 
 * This service uses multiple methods to detect user location:
 * 1. Headers from trusted proxies (Cloudflare, etc)
 * 2. Smart IP-based detection with pattern matching
 * 3. GeoIP lookup (when databases are available)
 * 4. Fallback to test data for development
 * 
 * It provides city-level information when available.
 */

import * as countryList from 'country-list';
import { createRequire } from 'module';
import { Request } from 'express';

// geoip-lite loads ~150MB of data into memory, so it's only loaded on first use
// and left out of the Vercel bundle (Vercel supplies location headers instead)
type GeoipLite = typeof import('geoip-lite');
let geoipModule: GeoipLite | null | undefined;
function getGeoip(): GeoipLite | null {
  if (geoipModule === undefined) {
    try {
      geoipModule = createRequire(import.meta.url)('geoip-lite') as GeoipLite;
    } catch {
      console.warn('geoip-lite is not available; IP lookups are disabled');
      geoipModule = null;
    }
  }
  return geoipModule;
}

const { getName } = countryList;

// Define the structure of geolocation info
export interface GeoLocationInfo {
  code: string;
  name: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

class GeolocationService {
  constructor() {
    console.log('Geolocation service initialized');
  }

  /**
   * Get the real client IP from request headers
   * This handles various proxy configurations
   */
  private getRealIp(req: Request): string {
    // Extract IP from common proxy headers
    const forwardedFor = req.headers['x-forwarded-for'] as string | undefined;
    const realIp = req.headers['x-real-ip'] as string | undefined;
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string | undefined;
    
    // Start with Cloudflare's connecting IP as it's most reliable when available
    if (cfConnectingIp) {
      return cfConnectingIp;
    }
    
    // X-Forwarded-For has format: client, proxy1, proxy2...
    if (forwardedFor) {
      // Take the leftmost IP (client)
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      if (ips.length > 0 && ips[0]) {
        return ips[0];
      }
    }
    
    // Try X-Real-IP header
    if (realIp) {
      return realIp;
    }
    
    // Fallback to request's IP
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  }

  /**
   * Detect geolocation from Vercel's edge headers when deployed there
   */
  private getVercelLocation(req: Request): GeoLocationInfo | null {
    const country = req.headers['x-vercel-ip-country'] as string | undefined;
    if (!country) return null;

    const header = (name: string) => {
      const value = req.headers[name] as string | undefined;
      return value ? decodeURIComponent(value) : undefined;
    };
    const latitude = Number(header('x-vercel-ip-latitude'));
    const longitude = Number(header('x-vercel-ip-longitude'));
    return {
      code: country,
      name: getName(country) || country,
      city: header('x-vercel-ip-city'),
      region: header('x-vercel-ip-country-region'),
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
    };
  }

  /**
   * Detect geolocation from Cloudflare headers when available
   */
  private getCloudflareLocation(req: Request): GeoLocationInfo | null {
    const cfCountry = req.headers['cf-ipcountry'] as string;
    if (!cfCountry) return null;
    
    // Cloudflare provides ISO country code
    return {
      code: cfCountry,
      name: getName(cfCountry) || cfCountry,
      // We can add more Cloudflare headers if available
      city: req.headers['cf-ipcity'] as string | undefined
    };
  }

  /**
   * Use geoip-lite for IP lookup
   */
  private lookupGeoIP(ip: string): GeoLocationInfo | null {
    try {
      const geo = getGeoip()?.lookup(ip);
      if (!geo) return null;
      
      console.log(`Found location via geoip-lite: ${geo.country}, ${geo.city}`);
      
      return {
        code: geo.country,
        name: getName(geo.country) || geo.country,
        city: geo.city,
        region: geo.region,
        latitude: geo.ll[0],
        longitude: geo.ll[1]
      };
    } catch (error) {
      console.error(`GeoIP lookup error for IP ${ip}:`, error);
      return null;
    }
  }

  /**
   * Get location using IP pattern recognition
   * This helps with IP ranges we can identify by pattern
   */
  private getLocationFromIPPattern(ip: string): GeoLocationInfo | null {
    // UAE patterns (commonly seen in our application)
    if (ip.startsWith('5.193.')) {
      console.log(`UAE IP pattern detected: ${ip}`);
      
      // Common cities in UAE based on IP ranges
      let city = "Dubai"; // Default
      
      // Different ranges for different cities
      if (ip.match(/^5\.193\.[1-5]\./)) {
        city = "Dubai";
      } else if (ip.match(/^5\.193\.[6-9]\./)) {
        city = "Abu Dhabi";
      } else if (ip.match(/^5\.193\.1[0-2]\./)) {
        city = "Sharjah";
      }
      
      return { 
        code: 'AE', 
        name: 'United Arab Emirates',
        city: city
      };
    }
    
    // UK patterns
    if (ip.match(/^(2\.2[0-9]|82\.1[0-9]|92\.23)/)) {
      return { 
        code: 'GB', 
        name: 'United Kingdom',
        city: 'London'
      };
    }
    
    // No pattern match
    return null;
  }


  /**
   * Get location information from request
   * Uses a fallback chain of methods
   */
  async getLocation(req: Request): Promise<GeoLocationInfo> {
    // For debugging, log headers
    if (process.env.NODE_ENV !== 'production') {
      console.log('Geolocation headers:', {
        'cf-ipcountry': req.headers['cf-ipcountry'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'ip': req.ip,
        'remoteAddress': req.socket.remoteAddress
      });
    }
    
    // 1. Try edge headers first (most reliable when available)
    const vercelLocation = this.getVercelLocation(req);
    if (vercelLocation) {
      console.log(`Location detected from Vercel headers: ${vercelLocation.name}${vercelLocation.city ? `, ${vercelLocation.city}` : ''}`);
      return vercelLocation;
    }

    const cloudflareLocation = this.getCloudflareLocation(req);
    if (cloudflareLocation) {
      console.log(`Location detected from Cloudflare headers: ${cloudflareLocation.name}${cloudflareLocation.city ? `, ${cloudflareLocation.city}` : ''}`);
      return cloudflareLocation;
    }
    
    // 2. Get real client IP
    const ip = this.getRealIp(req);
    console.log(`Real client IP for geolocation: ${ip}`);
    
    // 3. For development environment or internal IPs, use test data
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('::ffff:127.0.0.1')) {
      // Local development: there's no real location to report
      return { code: 'UNKNOWN', name: 'Unknown' };
    }
    
    // 4. Special handling for known IP patterns
    const forwardedFor = req.headers['x-forwarded-for'] as string | undefined;
    if (forwardedFor && forwardedFor.includes('5.193.')) {
      console.log(`UAE pattern detected in X-Forwarded-For: ${forwardedFor}`);
      
      // Extract the real client IP from the forwarded chain
      const clientIp = forwardedFor.split(',')[0].trim();
      const patternLocation = this.getLocationFromIPPattern(clientIp);
      
      if (patternLocation) {
        return patternLocation;
      }
    }
    
    // Check the direct IP as well
    const patternLocation = this.getLocationFromIPPattern(ip);
    if (patternLocation) {
      return patternLocation;
    }
    
    // 5. Try geoip-lite lookup
    const geoipLocation = this.lookupGeoIP(ip);
    if (geoipLocation) {
      console.log(`Location detected with GeoIP: ${geoipLocation.name}${geoipLocation.city ? `, ${geoipLocation.city}` : ''}`);
      return geoipLocation;
    }
    
    // 6. Fall back to unknown if all methods fail
    console.log('Location detection failed, using UNKNOWN');
    return { code: 'UNKNOWN', name: 'Unknown' };
  }
}

// Export singleton instance
export const geolocationService = new GeolocationService();