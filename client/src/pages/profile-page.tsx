import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiUser, FiLink, FiBarChart2, FiMail, FiBriefcase } from "react-icons/fi";
import { Loader2 } from "lucide-react";
import type { Url } from "@shared/schema";

export default function ProfilePage() {
  const { user } = useAuth();

  const { data: urlStats, isLoading } = useQuery<{
    urls: Url[];
    pagination: { total: number };
  }>({
    queryKey: ["/api/urls"],
    queryFn: async () => {
      const res = await fetch("/api/urls?limit=100");
      if (!res.ok) throw new Error("Failed to fetch URLs");
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

  const totalClicks = urlStats?.urls.reduce((sum, url) => sum + url.clicks, 0) || 0;
  const totalUrls = urlStats?.pagination.total || 0;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Profile</h1>

        <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FiUser className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                    <div className="text-sm text-muted-foreground">Full Name</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FiMail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{user?.email}</div>
                    <div className="text-sm text-muted-foreground">Email</div>
                  </div>
                </div>

                {user?.company && (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <FiBriefcase className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{user.company}</div>
                      <div className="text-sm text-muted-foreground">Company</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FiUser className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{user?.username}</div>
                    <div className="text-sm text-muted-foreground">Username</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FiLink className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">{totalUrls}</div>
                  <div className="text-sm text-muted-foreground">Total URLs</div>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FiBarChart2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">{totalClicks}</div>
                  <div className="text-sm text-muted-foreground">Total Clicks</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}