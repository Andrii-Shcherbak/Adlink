import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  FiLink, FiBarChart2, FiLogOut, FiUser, FiUsers, 
  FiActivity, FiFolder, FiChevronDown, FiSettings 
} from "react-icons/fi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrolled]);

  useEffect(() => {
    // Add a small delay to ensure smooth animation
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 opacity-30"
          style={{ 
            backgroundImage: "url('/images/gradient-bg.svg')",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-[500px] opacity-10"
          style={{ 
            backgroundImage: "url('/images/light-dots.svg')",
            backgroundSize: "cover",
          }}
        />
        {/* Subtle animated blobs */}
        <div className="absolute top-[10%] right-[20%] w-[600px] h-[600px] rounded-full blur-3xl bg-blue-500/5 animate-pulse-subtle" />
        <div className="absolute bottom-[30%] left-[10%] w-[500px] h-[500px] rounded-full blur-3xl bg-violet-500/5 animate-pulse-subtle" style={{ animationDelay: "1s" }} />
      </div>

      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'backdrop-blur-lg bg-gray-900/70 shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="font-bold text-xl flex items-center gap-2 transition-transform hover:scale-105">
                <img src="/images/adlink-logo.svg" alt="ADLink Logo" className="h-8 w-8" />
                <span className="bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">ADLink</span>
              </a>
            </Link>
            <nav className="hidden lg:flex items-center gap-6">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <a className={`flex items-center gap-2 py-1 px-3 rounded-lg text-sm font-medium transition-all hover:bg-white/10 ${
                    location === href 
                      ? 'text-white bg-gradient-to-r from-blue-600/20 to-violet-600/20 border border-white/10 shadow-sm' 
                      : 'text-white/70'
                  }`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1 text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <span className="text-sm hidden md:inline-block">{user?.firstName} {user?.lastName}</span>
                  </div>
                  <FiChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mr-2 mt-1 bg-gray-800/90 backdrop-blur-lg border-white/10 text-white">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-white/60 truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <div className="flex items-center gap-1 px-2 py-1">
                  {user?.userType && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.userType === 'internal' 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {user.userType === 'internal' ? 'Internal' : 'External'}
                    </span>
                  )}
                  {user?.role === 'admin' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
                      Admin
                    </span>
                  )}
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <Link href="/profile">
                  <a>
                    <DropdownMenuItem className="cursor-pointer hover:bg-white/10 text-white focus:bg-white/10 focus:text-white">
                      <FiUser className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                  </a>
                </Link>
                <Link href="/settings">
                  <a>
                    <DropdownMenuItem className="cursor-pointer hover:bg-white/10 text-white focus:bg-white/10 focus:text-white">
                      <FiSettings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                  </a>
                </Link>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  className="cursor-pointer text-red-300 hover:text-red-200 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-200"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <FiLogOut className="mr-2 h-4 w-4" />
                  <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      <main className={`pt-24 min-h-screen transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-white/5 bg-gray-950/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <img src="/images/adlink-logo.svg" alt="ADLink Logo" className="h-6 w-6" />
            <span className="text-sm text-white/50">
              ADLink © {new Date().getFullYear()} | Enterprise URL Management
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Terms</a>
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}