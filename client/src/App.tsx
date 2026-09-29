import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { queryClient } from "./lib/queryClient";
import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import AnalyticsPage from "@/pages/analytics-page";
import ProfilePage from "@/pages/profile-page";
import AdminPage from "@/pages/admin-page";
import ActivityDashboard from "@/pages/activity-dashboard";
import AuthStatus from "@/pages/auth-status";
import InvitePage from "@/pages/invite-page";
import AssetsPage from "@/pages/assets-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute } from "./lib/admin-route";
import { Layout } from "@/components/layout";
import ProtectedUrl from "@/pages/protected-url";

function ProtectedLayout({ component: Component }: { component: () => React.JSX.Element }) {
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

const APP_NAME = "Adlink";

const PAGE_TITLES: Record<string, string> = {
  "/": "URLs",
  "/analytics": "Analytics",
  "/profile": "Profile",
  "/assets": "Digital Assets",
  "/admin": "Admin",
  "/activities": "Activities",
  "/auth": "Sign in",
  "/auth-status": "Account Status",
};

function getPageTitle(path: string): string {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path];
  if (path.startsWith("/invite/")) return "Invitation";
  if (path.startsWith("/protected/")) return "Protected Link";
  return "Page Not Found";
}

function usePageTitle() {
  const [location] = useLocation();

  useEffect(() => {
    document.title = `${getPageTitle(location)} | ${APP_NAME}`;
  }, [location]);
}

function Router() {
  usePageTitle();

  return (
    <Switch>
      <ProtectedRoute path="/" component={() => <ProtectedLayout component={HomePage} />} />
      <ProtectedRoute path="/analytics" component={() => <ProtectedLayout component={AnalyticsPage} />} />
      <ProtectedRoute path="/profile" component={() => <ProtectedLayout component={ProfilePage} />} />
      <ProtectedRoute path="/assets" component={AssetsPage} />
      <AdminRoute path="/admin" component={() => <ProtectedLayout component={AdminPage} />} />
      <AdminRoute path="/activities" component={() => <ProtectedLayout component={ActivityDashboard} />} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth-status" component={AuthStatus} />
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/protected/:shortCode" component={ProtectedUrl} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;