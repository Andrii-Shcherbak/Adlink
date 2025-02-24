import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Activity } from "@shared/schema";

export default function ActivityDashboard() {
  const { data, isLoading } = useQuery<{
    activities: (Activity & { username: string; firstName: string; lastName: string; })[];
    pagination: { total: number; page: number; totalPages: number; hasMore: boolean; }
  }>({
    queryKey: ["/api/activities"],
    queryFn: async () => {
      const res = await fetch("/api/activities");
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Activity Log</h1>
        </div>
        <div className="grid gap-4">
          {data?.activities.map((activity) => (
            <Card key={activity.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">
                  {activity.firstName} {activity.lastName}
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(activity.timestamp), "PPpp")}
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Action:</span>{" "}
                    <span className="capitalize">{activity.type.replace(/_/g, " ")}</span>
                  </div>
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
