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
import { ProtectedRoute } from "./lib/protected-route";
import { Layout } from "@/components/layout";

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
      <Route path="/auth" component={AuthPage} />
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