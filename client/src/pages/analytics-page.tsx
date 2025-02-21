import { useQuery } from "@tanstack/react-query";
import { type Url } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

export default function AnalyticsPage() {
  const { data: urls = [], isLoading } = useQuery<Url[]>({
    queryKey: ["/api/urls"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        
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

        <Card>
          <CardHeader>
            <CardTitle>Country Analytics</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={urls.reduce((acc, url) => {
                  const analytics = url.analytics as { countries: Record<string, number> };
                  Object.entries(analytics.countries).forEach(([country, count]) => {
                    const countryName = country === 'unknown' ? 'Unknown' : country.toUpperCase();
                    const existingEntry = acc.find(entry => entry.name === countryName);
                    if (existingEntry) {
                      existingEntry.value += count;
                    } else {
                      acc.push({ name: countryName, value: count });
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
    </div>
  );
}
