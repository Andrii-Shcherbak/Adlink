import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { Activity } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as React from 'react';

export default function ActivityDashboard() {
  const [page, setPage] = React.useState(1);
  const limit = 10;

  const { data, isLoading } = useQuery<{
    activities: (Activity & { username: string; firstName: string; lastName: string; })[];
    pagination: { total: number; page: number; totalPages: number; hasMore: boolean; }
  }>({
    queryKey: ["/api/activities", page],
    queryFn: async () => {
      const res = await fetch(`/api/activities?page=${page}&limit=${limit}`);
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

  const renderActivityContent = (activity: typeof data.activities[0]) => {
    switch (activity.type) {
      case 'login':
        return `Logged in via ${activity.metadata.method}`;
      case 'logout':
        return 'Logged out';
      case 'url_created':
        return `Created short URL: ${activity.metadata.shortCode} for ${activity.metadata.originalUrl}`;
      case 'url_deleted':
        return `Deleted short URL: ${activity.metadata.shortCode}`;
      case 'user_status_update':
        const changes = activity.metadata.changes;
        return `Updated user status: ${
          changes.isActive !== undefined ? `Active: ${changes.isActive}` : ''
        } ${
          changes.isApproved !== undefined ? `Approved: ${changes.isApproved}` : ''
        }`;
      default:
        return JSON.stringify(activity.metadata);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Activity Log</h1>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(activity.timestamp), "PPpp")}
                  </TableCell>
                  <TableCell>
                    {activity.firstName} {activity.lastName}
                  </TableCell>
                  <TableCell>{renderActivityContent(activity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end space-x-2 p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!data?.pagination.hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}