import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FiLink, FiBarChart2, FiLogOut, FiUser } from "react-icons/fi";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "URLs", icon: FiLink },
    { href: "/analytics", label: "Analytics", icon: FiBarChart2 },
    { href: "/profile", label: "Profile", icon: FiUser },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="font-bold text-xl">URL Shortener</a>
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
            <span className="text-sm text-muted-foreground">
              {user?.username}
            </span>
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