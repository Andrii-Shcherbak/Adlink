import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FiLink, FiBarChart2, FiLogOut, FiUser, FiUsers, FiActivity, FiFolder } from "react-icons/fi";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "URLs", icon: FiLink },
    { href: "/analytics", label: "Analytics", icon: FiBarChart2 },
    { href: "/assets", label: "Digital Assets", icon: FiFolder },
    { href: "/profile", label: "Profile", icon: FiUser },
    // Only show Admin and Activities links for admin users
    ...(user?.role === "admin" ? [
      { href: "/admin", label: "Admin", icon: FiUsers },
      { href: "/activities", label: "Activities", icon: FiActivity }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="font-bold text-xl flex items-center gap-2">
                <FiLink className="h-5 w-5 text-primary" />
                <span className="bg-gradient-to-r from-primary to-indigo-500 text-transparent bg-clip-text">ADLink</span>
              </a>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <a className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${location === href ? 'text-primary' : 'text-muted-foreground'}`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                {user?.userType && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.userType === 'internal' 
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300' 
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                  }`}>
                    {user.userType === 'internal' ? 'Internal' : 'External'}
                  </span>
                )}
                {user?.role === 'admin' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {user?.email}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <FiLogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}