import { useQuery } from "@tanstack/react-query";
import { type Url } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

export default function AnalyticsPage() {
  // Update to fetch only current user's URLs with a larger limit
  const { data, isLoading } = useQuery<{
    urls: Url[];
    pagination: { total: number; page: number; totalPages: number; hasMore: boolean; }
  }>({
    queryKey: ["/api/urls"],
    queryFn: async () => {
      const res = await fetch("/api/urls?limit=100&page=1"); // Get more URLs for analytics
      if (!res.ok) throw new Error("Failed to fetch URLs");
      return res.json();
    },
  });

  const urls = data?.urls || [];

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
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">
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
                  data={urls.reduce((acc, url) => {
                    const analytics = url.analytics as { devices: Record<string, number> };
                    Object.entries(analytics.devices).forEach(([device, count]) => {
                      const existingEntry = acc.find(entry => entry.name === device);
                      if (existingEntry) {
                        existingEntry.value += count;
                      } else {
                        acc.push({ name: device, value: count });
                      }
                    });
                    return acc;
                  }, [] as { name: string; value: number }[])}
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
                  data={urls.reduce((acc, url) => {
                    const analytics = url.analytics as any;
                    const countries = analytics.countries || {};
                    
                    Object.entries(countries).forEach(([code, data]) => {
                      // Handle both old format (number) and new format (object with count and name)
                      if (typeof data === 'number') {
                        // Old format - just a number count
                        const countryName = code === 'UNKNOWN' ? 'Unknown' : code;
                        const existingEntry = acc.find(entry => entry.name === countryName);
                        if (existingEntry) {
                          existingEntry.value += data;
                        } else {
                          acc.push({ name: countryName, value: data });
                        }
                      } else if (data && typeof data === 'object') {
                        // New format - object with count and name
                        const countryData = data as { count: number, name?: string, cities?: Record<string, number> };
                        const countryName = countryData.name || (code === 'UNKNOWN' ? 'Unknown' : code);
                        
                        // Count total cities clicks if cities data exists
                        let citiesTotal = 0;
                        if (countryData.cities) {
                          citiesTotal = Object.values(countryData.cities).reduce((sum, count) => sum + count, 0);
                        }
                        
                        // Use the greater of explicit count or cities total (for data consistency)
                        const actualCount = Math.max(countryData.count || 0, citiesTotal);
                        
                        const existingEntry = acc.find(entry => entry.name === countryName);
                        if (existingEntry) {
                          existingEntry.value += actualCount;
                        } else {
                          acc.push({ 
                            name: countryName, 
                            value: actualCount,
                            code // Keep code for reference
                          });
                        }
                      }
                    });
                    return acc;
                  }, [] as { name: string; value: number; code?: string }[])
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 10) // Show top 10 countries for better readability
                  }
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
                  data={urls.reduce((acc, url) => {
                    const analytics = url.analytics as { referrers: Record<string, number> };
                    Object.entries(analytics.referrers || {}).forEach(([referrer, count]) => {
                      const existingEntry = acc.find(entry => entry.name === referrer);
                      if (existingEntry) {
                        existingEntry.value += count;
                      } else {
                        acc.push({ name: referrer || 'direct', value: count });
                      }
                    });
                    return acc;
                  }, [] as { name: string; value: number }[])
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 10) // Show top 10 referrers for better readability
                  }
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
                            // Format city name with proper capitalization
                            displayName = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
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