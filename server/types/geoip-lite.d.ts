declare module 'geoip-lite' {
  export interface Lookup {
    range: [number, number];
    country: string;
    region: string;
    city: string;
    ll: [number, number]; // latitude, longitude
    metro: number;
    area: number;
    eu: string;
    timezone: string;
  }

  export function lookup(ip: string): Lookup | null;
  export function pretty(ip: string): string;
  export function startWatchingDataUpdate(): void;
  export function stopWatchingDataUpdate(): void;
  export function reloadDataSync(): void;
  export function reloadData(callback: (err: Error) => void): void;
}