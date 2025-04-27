import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FiLink, FiBarChart2, FiLogOut, FiUser, FiUsers, FiActivity, FiFolder, FiMenu, FiX } from "react-icons/fi";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Track scroll position to add blur effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
      {/* Gradient Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-blue-600 via-gray-900 to-purple-800"></div>
        <div 
          className="absolute opacity-5 top-0 left-0 right-0 bottom-0"
          style={{ 
            backgroundImage: "url('/images/light-dots.svg')",
            backgroundSize: "cover",
          }}
        />
      </div>

      <header className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'backdrop-blur-lg bg-gray-950/70' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="font-bold text-xl flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white">
                  <FiLink className="h-4 w-4" />
                </div>
                <span className="bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">ADLink</span>
              </a>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <a onClick={(e) => {
                    // Use regular link behavior for non-anchor elements
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'A') {
                      e.preventDefault();
                      window.history.pushState({}, '', href);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                  }} className={`flex items-center gap-2 text-sm font-medium transition-all hover:text-blue-400 px-3 py-2 rounded-lg ${
                    location === href 
                      ? 'text-blue-400 bg-white/5' 
                      : 'text-white/70'
                  }`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                </Link>
              ))}
            </nav>
          </div>
          
          {/* User Profile and Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {user?.firstName} {user?.lastName}
                </span>
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
              <span className="text-xs text-white/60">
                {user?.email}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="hidden md:flex bg-white/5 hover:bg-white/10 text-white border-white/10"
            >
              <FiLogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
            
            {/* Mobile Menu Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-white">
                  <FiMenu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-gray-900/95 backdrop-blur-xl border-gray-800 text-white">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8 pt-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white">
                        <FiLink className="h-4 w-4" />
                      </div>
                      <span className="bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text font-bold">ADLink</span>
                    </div>
                  </div>
                  
                  {/* User Profile for Mobile */}
                  <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xl font-semibold">
                        {user?.firstName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                        <div className="text-sm text-white/60">{user?.email}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                  </div>
                  
                  {/* Mobile Navigation */}
                  <nav className="space-y-1">
                    {navItems.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href}>
                        <a onClick={(e) => {
                          // Use regular link behavior for non-anchor elements
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'A') {
                            e.preventDefault();
                            window.history.pushState({}, '', href);
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          }
                        }} className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors ${
                          location === href 
                            ? 'bg-blue-600/20 text-blue-300' 
                            : 'hover:bg-white/5'
                        }`}>
                          <Icon className="h-5 w-5" />
                          {label}
                        </a>
                      </Link>
                    ))}
                  </nav>
                  
                  <div className="mt-auto pt-6 border-t border-white/10">
                    <Button
                      variant="ghost"
                      className="w-full justify-start bg-white/5 hover:bg-white/10 text-white"
                      onClick={() => logoutMutation.mutate()}
                      disabled={logoutMutation.isPending}
                    >
                      <FiLogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      
      <main className="relative z-10">
        {children}
      </main>
    </div>
  );
}