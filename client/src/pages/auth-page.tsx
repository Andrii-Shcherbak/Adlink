import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { FiLink, FiBarChart2, FiGlobe, FiCode, FiUser, FiLock, FiMail, FiBriefcase, FiArrowRight } from "react-icons/fi";
import { useState, useEffect } from "react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Add a small delay to ensure smooth animation
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const loginForm = useForm<Pick<InsertUser, "username" | "password">>({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      company: "",
    },
  });

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gray-950">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-30"
          style={{ 
            backgroundImage: "url('/images/gradient-bg.svg')",
            backgroundSize: "cover",
          }}
        />
        <div 
          className="absolute opacity-10 top-0 left-0 right-0 bottom-0"
          style={{ 
            backgroundImage: "url('/images/light-dots.svg')",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-3xl rounded-full bg-blue-500/10 animate-pulse" />
        <div className="absolute top-[45%] left-[48%] transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] blur-3xl rounded-full bg-purple-500/10 animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
      
      <div className={`container max-w-screen-xl mx-auto px-4 py-8 md:py-12 relative z-10 flex flex-col md:flex-row gap-12 items-center transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        {/* Left side - Branding and Features */}
        <div className="w-full md:w-1/2 text-white space-y-6 md:space-y-12">
          <div className="space-y-4 text-center md:text-left transition-all duration-700 delay-100">
            <img src="/images/adlink-logo.svg" alt="ADLink Logo" className="h-24 w-24 mx-auto md:mx-0" />
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              <span className="bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">ADLink</span>
            </h1>
            <p className="text-xl md:text-2xl font-light text-white/80 max-w-md mt-4">
              Enterprise URL management with powerful analytics and QR code generation
            </p>
          </div>
          
          <div className="hidden md:block transition-all duration-700 delay-300">
            <div className="grid grid-cols-2 gap-8 mt-8">
              <Feature 
                icon={<FiLink className="h-6 w-6 text-blue-400" />}
                title="Smart Shortening"
                description="Create concise, branded URLs with AI-enhanced title generation"
              />
              <Feature 
                icon={<FiCode className="h-6 w-6 text-blue-400" />}
                title="Custom QR Codes"
                description="Design beautiful QR codes with your logo and custom colors"
              />
              <Feature 
                icon={<FiBarChart2 className="h-6 w-6 text-blue-400" />}
                title="Detailed Analytics"
                description="Get insights on geography, devices, and user behavior"
              />
              <Feature 
                icon={<FiGlobe className="h-6 w-6 text-blue-400" />}
                title="Device Targeting"
                description="Direct users to different destinations based on their device"
              />
            </div>
          </div>
        </div>
        
        {/* Right side - Auth Forms */}
        <div className="w-full md:w-1/2 flex justify-center transition-all duration-700 delay-500">
          <Card className="w-full max-w-md bg-gray-900/40 border border-white/10 shadow-2xl backdrop-blur-xl rounded-2xl p-1 overflow-hidden">
            <div className="absolute opacity-50 -top-32 -right-32 w-64 h-64" style={{ 
              backgroundImage: "url('/images/blob-shape.svg')",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat"
            }} />
            
            <CardHeader className="space-y-2 relative z-10">
              <CardTitle className="text-2xl font-medium text-white">Welcome</CardTitle>
              <CardDescription className="text-white/70">
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative z-10">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 p-1 rounded-lg mb-6">
                  <TabsTrigger value="login" className="text-sm font-medium data-[state=active]:bg-gradient-to-r from-blue-600 to-violet-600 data-[state=active]:text-white">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" className="text-sm font-medium data-[state=active]:bg-gradient-to-r from-blue-600 to-violet-600 data-[state=active]:text-white">
                    Create Account
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <div className="space-y-2 mb-6">
                    <h3 className="text-lg font-medium text-white">Sign in to your account</h3>
                    <p className="text-sm text-white/60">Enter your credentials below to continue</p>
                  </div>
                  
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">Username</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input 
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="Enter your username" 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input 
                                  type="password" 
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="Enter your password" 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full h-11 text-base font-medium bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.02] mt-2"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Signing in..." : (
                          <span className="flex items-center justify-center">
                            Sign In
                            <FiArrowRight className="ml-2 h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-gray-900/40 px-2 text-white/60">
                        Or continue with
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-base text-white border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 rounded-lg transition-all duration-300"
                    onClick={() => window.location.href = `/api/auth/microsoft`}
                  >
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23">
                      <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                      <path fill="#f35325" d="M1 1h10v10H1z"/>
                      <path fill="#81bc06" d="M12 1h10v10H12z"/>
                      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                      <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                    Sign in with Microsoft
                  </Button>
                </TabsContent>

                <TabsContent value="register">
                  <div className="space-y-2 mb-6">
                    <h3 className="text-lg font-medium text-white">Create a new account</h3>
                    <p className="text-sm text-white/60">Fill in the details below to get started</p>
                  </div>
                  
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-white/80">First Name</FormLabel>
                              <FormControl>
                                <Input 
                                  className="h-11 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="John" 
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-white/80">Last Name</FormLabel>
                              <FormControl>
                                <Input 
                                  className="h-11 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="Doe" 
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input 
                                  type="email" 
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="you@example.com" 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">Company (Optional)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiBriefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input 
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="Your company" 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">Username</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input 
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="Choose a username" 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input 
                                  type="password" 
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                  {...field} 
                                  placeholder="Choose a strong password" 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full h-11 text-base font-medium bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.02] mt-2"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating account..." : (
                          <span className="flex items-center justify-center">
                            Create Account
                            <FiArrowRight className="ml-2 h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
            
            <CardFooter className="pt-0 opacity-70 text-xs text-center text-white/50">
              <p className="w-full">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Decorative floating elements */}
      <div className="hidden md:block absolute bottom-4 left-8 animate-bounce-slow opacity-20">
        <div className="h-16 w-16 rounded-full bg-blue-500/20 blur-lg"></div>
      </div>
      <div className="hidden md:block absolute top-8 right-12 animate-bounce-slow delay-300 opacity-20">
        <div className="h-12 w-12 rounded-full bg-violet-500/20 blur-lg"></div>
      </div>
    </div>
  );
}

// Feature component for the left side
function Feature({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex gap-4 items-start p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 transform hover:scale-[1.03]">
      <div className="flex-shrink-0 mt-1">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-medium text-white mb-1">{title}</h3>
        <p className="text-sm text-white/70">{description}</p>
      </div>
    </div>
  );
}