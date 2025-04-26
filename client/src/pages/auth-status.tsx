import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { FiAlertTriangle } from "react-icons/fi";
import { useQuery } from "@tanstack/react-query";

export default function AuthStatus() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

  const { data: statusData } = useQuery({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status");
      if (!res.ok) throw new Error("Failed to fetch auth status");
      return res.json();
    },
  });

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <FiAlertTriangle className="h-12 w-12 text-destructive" />
          <h1 className="text-2xl font-bold">Account {!user.isApproved ? "Pending Approval" : "Disabled"}</h1>

          {!user.isApproved ? (
            <p className="text-muted-foreground">
              {statusData?.message || "Your account is pending administrator approval. Please contact the administrator to get your account approved."}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {statusData?.message || "Your account has been disabled. Please contact the administrator for more information."}
            </p>
          )}

          <Button onClick={handleLogout} variant="outline" className="mt-4">
            Return to Login
          </Button>
        </div>
      </Card>
    </div>
  );
}