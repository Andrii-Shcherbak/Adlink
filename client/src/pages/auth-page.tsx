import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FiLink, FiBarChart2, FiGlobe, FiCode, FiUser, FiLock } from "react-icons/fi";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();

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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Background Image - Full screen on mobile, half screen on desktop */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center md:w-1/2 md:right-0 md:left-auto"
        style={{ 
          backgroundImage: "url('/images/aerial-background.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat"
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/60 md:bg-primary/60 backdrop-blur-sm"></div>
      </div>
      
      {/* Mobile background overlay */}
      <div className="absolute inset-0 z-0 md:hidden bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-sm"></div>
      
      {/* Login Panel */}
      <div className="relative z-10 flex items-center justify-center p-8 w-full md:w-1/2">
        <Card className="w-full max-w-md border-none shadow-xl bg-black/20 text-white backdrop-blur-md rounded-xl border border-white/10">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground">
                <FiLink className="w-6 h-6" />
              </div>
              <CardTitle className="text-3xl">
                <span className="bg-gradient-to-r from-primary to-indigo-500 text-transparent bg-clip-text font-bold">ADLink</span>
              </CardTitle>
            </div>
            <CardDescription className="text-base text-white/90">
              Welcome to ADLink! Please enter your details to access your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full text-white [&_label]:text-white">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="login" className="text-sm font-medium data-[state=active]:bg-primary/30">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="text-sm font-medium data-[state=active]:bg-primary/30">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-6">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70" />
                              <Input className="h-11 pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Enter your username" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70" />
                              <Input type="password" className="h-11 pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Enter your password" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-11 text-base font-medium bg-primary/80 hover:bg-primary/90"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/20" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-transparent px-2 text-white">
                          Or continue with
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 text-base text-white border-white/20 bg-white/10 hover:bg-white/20"
                      onClick={() => window.location.href = `/api/auth/microsoft`}
                    >
                      <FiUser className="mr-2 h-5 w-5" />
                      Sign in with Microsoft
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-6">

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">First Name</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="John" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Last Name</FormLabel>
                            <FormControl>
                              <Input className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Doe" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type="email" className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="you@example.com" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Company (Optional)</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Your company" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70" />
                              <Input className="h-11 pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Choose a username" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70" />
                              <Input type="password" className="h-11 pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="Choose a strong password" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-11 text-base font-medium bg-primary/80 hover:bg-primary/90"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Feature Highlights - Visible on desktop only */}
      <div className="hidden md:flex md:w-1/2 relative z-10 flex-col justify-center px-12 py-16 text-white">
        <div className="max-w-md mx-auto space-y-8 backdrop-blur-sm bg-primary/20 p-8 rounded-2xl border border-white/10 shadow-xl">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Professional URL Management Made Simple
            </h1>
            <p className="text-lg text-white/90">
              Streamline your link sharing with our powerful URL shortening service. Generate QR codes, track analytics, and manage all your links in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <FiLink className="w-6 h-6" />
              </div>
              <h3 className="font-medium">URL Shortening</h3>
              <p className="text-sm text-white/80">
                Create concise, memorable links that are perfect for sharing
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <FiCode className="w-6 h-6" />
              </div>
              <h3 className="font-medium">QR Codes</h3>
              <p className="text-sm text-white/80">
                Generate customizable QR codes for easy mobile access
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <FiBarChart2 className="w-6 h-6" />
              </div>
              <h3 className="font-medium">Analytics</h3>
              <p className="text-sm text-white/80">
                Track link performance with detailed click analytics
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <FiGlobe className="w-6 h-6" />
              </div>
              <h3 className="font-medium">Global Access</h3>
              <p className="text-sm text-white/80">
                Share your links worldwide with reliable redirection
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}