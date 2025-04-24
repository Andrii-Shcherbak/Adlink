import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
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

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={() => <ProtectedLayout component={HomePage} />} />
      <ProtectedRoute path="/analytics" component={() => <ProtectedLayout component={AnalyticsPage} />} />
      <ProtectedRoute path="/profile" component={() => <ProtectedLayout component={ProfilePage} />} />
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