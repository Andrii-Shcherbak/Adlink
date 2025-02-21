import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FiLink, FiBarChart2, FiGlobe, FiCode } from "react-icons/fi";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();

  const loginForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "" },
  });

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-none shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-2">
              <FiLink className="w-8 h-8 text-primary" />
              <CardTitle className="text-2xl">URL Shortener</CardTitle>
            </div>
            <CardDescription className="text-base">
              Welcome back! Please enter your details to access your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-6">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input className="h-11" {...field} />
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-11 text-base"
                      disabled={loginMutation.isPending}
                    >
                      Sign In
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-6">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input className="h-11" {...field} />
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-11 text-base"
                      disabled={registerMutation.isPending}
                    >
                      Create Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="hidden md:flex flex-col justify-center p-12 bg-primary text-primary-foreground">
        <div className="max-w-md mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Professional URL Management Made Simple
            </h1>
            <p className="text-lg text-primary-foreground/80">
              Streamline your link sharing with our powerful URL shortening service. Generate QR codes, track analytics, and manage all your links in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <FiLink className="w-6 h-6" />
              </div>
              <h3 className="font-medium">URL Shortening</h3>
              <p className="text-sm text-primary-foreground/70">
                Create concise, memorable links that are perfect for sharing
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <FiCode className="w-6 h-6" />
              </div>
              <h3 className="font-medium">QR Codes</h3>
              <p className="text-sm text-primary-foreground/70">
                Generate customizable QR codes for easy mobile access
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <FiBarChart2 className="w-6 h-6" />
              </div>
              <h3 className="font-medium">Analytics</h3>
              <p className="text-sm text-primary-foreground/70">
                Track link performance with detailed click analytics
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <FiGlobe className="w-6 h-6" />
              </div>
              <h3 className="font-medium">Global Access</h3>
              <p className="text-sm text-primary-foreground/70">
                Share your links worldwide with reliable redirection
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}