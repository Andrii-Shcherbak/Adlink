import { useQuery } from "@tanstack/react-query";
import { type Url } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

type ChartEntry = { name: string; value: number };

type CountryData = number | { count?: number; name?: string; cities?: Record<string, number> };

function analyticsOf(url: Url): any {
  return (url.analytics as any) || {};
}

function topEntries(totals: Map<string, number>, limit: number): ChartEntry[] {
  return Array.from(totals, ([name, value]) => ({ name, value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Adds up a `{ label: count }` map across all links, optionally merging labels. */
function sumCounts(
  urls: Url[],
  pick: (analytics: any) => Record<string, number> | undefined,
  labelOf: (name: string) => string = (name) => name,
  limit = 10,
): ChartEntry[] {
  const totals = new Map<string, number>();
  for (const url of urls) {
    for (const [name, count] of Object.entries(pick(analyticsOf(url)) || {})) {
      const label = labelOf(name);
      if (typeof count === "number") totals.set(label, (totals.get(label) || 0) + count);
    }
  }
  return topEntries(totals, limit);
}

// "iOS 18.1.1" -> "iOS", "macOS 10.15.7" -> "macOS": browsers report versions inconsistently
function osFamily(name: string): string {
  return name.replace(/\s+[\d._]+$/, "") || name;
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

// Short, familiar names ("United Kingdom") instead of official ones
function countryLabel(code: string, recordedName: string): string {
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      const name = regionNames?.of(code);
      if (name && name !== code) return name;
    } catch {
      // fall through to the recorded name
    }
  }
  return recordedName;
}

/** Totals per country code, labelled with the name most clicks were recorded under. */
function countryTotals(urls: Url[]): ChartEntry[] {
  const byCode = new Map<string, { value: number; names: Map<string, number> }>();
  for (const url of urls) {
    for (const [rawCode, data] of Object.entries(analyticsOf(url).countries || {}) as [string, CountryData][]) {
      // Early data could contain a missing code ("undefined")
      const code = /^[A-Za-z]{2}$/.test(rawCode) ? rawCode.toUpperCase() : "UNKNOWN";
      const count = typeof data === "number" ? data : data?.count || 0;
      const name = code === "UNKNOWN" ? "Unknown" : countryLabel(code, (typeof data === "object" && data?.name) || code);
      const entry = byCode.get(code) || { value: 0, names: new Map() };
      entry.value += count;
      entry.names.set(name, (entry.names.get(name) || 0) + count);
      byCode.set(code, entry);
    }
  }
  const totals = new Map<string, number>();
  byCode.forEach(({ value, names }) => {
    const label = Array.from(names).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
    totals.set(label, (totals.get(label) || 0) + value);
  });
  return topEntries(totals, 10);
}

function titleCase(text: string): string {
  // "council bluffs" -> "Council Bluffs", "são paulo" -> "São Paulo"
  return text
    .toLowerCase()
    .split(/([\s-]+)/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const PAGE_SIZE = 100;

async function fetchAllUrls(): Promise<Url[]> {
  const all: Url[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`/api/urls?limit=${PAGE_SIZE}&page=${page}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch URLs");
    const data: { urls: Url[]; pagination: { hasMore?: boolean; totalPages?: number } } = await res.json();
    all.push(...data.urls);
    const hasMore = data.pagination?.hasMore ?? page < (data.pagination?.totalPages ?? 0);
    if (!hasMore || data.urls.length === 0) return all;
  }
}

export default function AnalyticsPage() {
  const { data: urls = [], isLoading } = useQuery<Url[]>({
    queryKey: ["/api/urls", "all-for-analytics"],
    queryFn: fetchAllUrls,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No data message when user has no URLs
  if (urls.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-white">Analytics Dashboard</h1>
          <div className="text-center py-8 text-white/70">
            No URLs found. Create some shortened URLs to see analytics!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Click Analytics</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={urls}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="shortCode" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Device Analytics</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sumCounts(urls, (analytics) => analytics.devices)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Country Analytics</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={countryTotals(urls)}
                  margin={{ top: 20, right: 30, left: 50, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip 
                    labelFormatter={(label) => `Country: ${label}`}
                    formatter={(value, name, props) => {
                      return [value, 'Clicks'];
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referrer Analytics</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={sumCounts(urls, (analytics) => analytics.referrers)}
                  margin={{ top: 20, right: 30, left: 50, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip 
                    labelFormatter={(label) => `Referrer: ${label}`}
                    formatter={(value, name, props) => {
                      return [value, 'Clicks'];
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
          {[
            { title: "Operating Systems", label: "OS", data: sumCounts(urls, (analytics) => analytics.deviceDetails?.os, osFamily) },
            { title: "Device Brands", label: "Brand", data: sumCounts(urls, (analytics) => analytics.deviceDetails?.brands) },
          ].map((chart) => (
            <Card key={chart.title}>
              <CardHeader>
                <CardTitle>{chart.title}</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px]">
                {chart.data.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={chart.data} margin={{ top: 20, right: 30, left: 50, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={120} />
                      <Tooltip labelFormatter={(label) => `${chart.label}: ${label}`} formatter={(value) => [value, "Clicks"]} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>City Analytics</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={urls.reduce((acc, url) => {
                  const analytics = url.analytics as any;
                  const countries = analytics.countries || {};
                  
                  Object.entries(countries).forEach(([code, data]) => {
                    // Skip old format data (numbers) since they don't have city info
                    if (typeof data === 'object' && data !== null) {
                      const countryData = data as { count: number, name: string, cities?: Record<string, number> };
                      
                      if (countryData.cities) {
                        Object.entries(countryData.cities).forEach(([cityName, count]) => {
                          if (!cityName || cityName.trim() === '') return; // Skip empty city names
                          
                          // Handle a common case where unknown cities are marked with dashes or "unknown"
                          let displayName = cityName;
                          if (cityName === '-' || cityName.toLowerCase() === 'unknown') {
                            displayName = `Unknown (${countryData.name || code})`;
                          } else {
                            displayName = titleCase(cityName);
                          }
                          
                          const existingEntry = acc.find(entry => entry.name === displayName);
                          
                          if (existingEntry) {
                            existingEntry.value += count;
                          } else {
                            acc.push({ 
                              name: displayName, 
                              value: count,
                              country: countryData.name || code
                            });
                          }
                        });
                      }
                    }
                  });
                  
                  return acc;
                }, [] as { name: string; value: number; country?: string }[])
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 12) // Show top 12 cities for better readability
                }
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip 
                  labelFormatter={(label) => `City: ${label}`} 
                  formatter={(value, name, props) => {
                    return [value, props.payload.country ? `Clicks (${props.payload.country})` : 'Clicks'];
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}