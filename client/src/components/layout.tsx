import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  FiLink, FiBarChart2, FiLogOut, FiUser, FiUsers, 
  FiActivity, FiFolder, FiMenu, FiChevronDown, 
  FiSettings, FiHome 
} from "react-icons/fi";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  // No need for scroll state anymore since the header is not sticky

  // Main navigation items - keep this minimal
  const mainNavItems = [
    { href: "/", label: "URLs", icon: FiHome },
    { href: "/analytics", label: "Analytics", icon: FiBarChart2 },
    { href: "/assets", label: "Digital Assets", icon: FiFolder },
  ];

  // User menu items - moved to dropdown
  const userMenuItems = [
    { href: "/profile", label: "Profile", icon: FiUser },
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

      <header className="relative z-50 transition-all duration-300 bg-transparent">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div onClick={() => {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }} className="font-bold text-xl flex items-center gap-2 cursor-pointer">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white">
                  <FiLink className="h-4 w-4" />
                </div>
                <span className="bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">ADLink</span>
            </div>
            
            {/* Desktop Navigation - Simplified */}
            <nav className="hidden lg:flex items-center gap-6">
              {mainNavItems.map(({ href, label, icon: Icon }) => (
                <div 
                  key={href} 
                  onClick={() => {
                    window.history.pushState({}, '', href);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className={`flex items-center gap-2 text-sm font-medium transition-all hover:text-blue-400 px-3 py-2 rounded-lg cursor-pointer ${
                    location === href 
                      ? 'text-blue-400 bg-white/5' 
                      : 'text-white/70'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              ))}
            </nav>
          </div>
          
          {/* User Dropdown Menu */}
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hidden md:flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 text-white border-white/10 pl-2 pr-3 rounded-full h-9"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-semibold mr-1">
                    {user?.firstName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </div>
                  <span className="text-sm font-medium">
                    {user?.firstName || user?.username}
                  </span>
                  <FiChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                sideOffset={5} 
                className="w-64 bg-gray-900/95 backdrop-blur-xl border-gray-800 text-white shadow-xl"
              >
                <DropdownMenuLabel className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{user?.firstName} {user?.lastName}</span>
                    <span className="text-xs text-white/60 mt-1">{user?.email}</span>
                    <div className="flex flex-wrap gap-1 mt-2">
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
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuGroup>
                  {userMenuItems.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem 
                      key={href} 
                      className={`px-4 py-2 cursor-pointer ${
                        location === href 
                          ? 'bg-blue-600/20 text-blue-300' 
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => {
                        window.history.pushState({}, '', href);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      <span>{label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  className="px-4 py-2 text-red-300 hover:bg-red-950/20 cursor-pointer"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <FiLogOut className="h-4 w-4 mr-2" />
                  <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
                  <div className="mb-4">
                    <div className="text-xs uppercase text-white/40 font-semibold tracking-wider px-4 mb-2">Main Navigation</div>
                    <nav className="space-y-1">
                      {mainNavItems.map(({ href, label, icon: Icon }) => (
                        <div 
                          key={href} 
                          onClick={() => {
                            window.history.pushState({}, '', href);
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          }}
                          className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors cursor-pointer ${
                            location === href 
                              ? 'bg-blue-600/20 text-blue-300' 
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </div>
                      ))}
                    </nav>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-xs uppercase text-white/40 font-semibold tracking-wider px-4 mb-2">User Menu</div>
                    <nav className="space-y-1">
                      {userMenuItems.map(({ href, label, icon: Icon }) => (
                        <div 
                          key={href} 
                          onClick={() => {
                            window.history.pushState({}, '', href);
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          }}
                          className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors cursor-pointer ${
                            location === href 
                              ? 'bg-blue-600/20 text-blue-300' 
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </div>
                      ))}
                    </nav>
                  </div>
                  
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
      
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}