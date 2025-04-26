import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Check, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface InviteData {
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  inviteSentAt: string;
  userType?: 'internal' | 'external';
  role?: 'admin' | 'user';
}

interface InviteAcceptForm {
  username: string;
  password: string;
  confirmPassword: string;
}

export default function InvitePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  const form = useForm<InviteAcceptForm>({
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Extract token from URL
  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    if (pathParts.length >= 3 && pathParts[1] === "invite") {
      setToken(pathParts[2]);
    } else {
      setError("Invalid invitation link");
      setLoading(false);
    }
  }, []);

  // Fetch invitation details when token is available
  useEffect(() => {
    if (!token) return;

    const fetchInviteData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/invites/${token}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("Invitation not found or expired");
          } else if (response.status === 400) {
            const data = await response.json();
            setError(data.error || "This invitation has already been accepted");
          } else {
            setError("An error occurred while retrieving the invitation");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setInviteData(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching invitation:", err);
        setError("An error occurred while retrieving the invitation");
        setLoading(false);
      }
    };

    fetchInviteData();
  }, [token]);

  const onSubmit = async (formData: InviteAcceptForm) => {
    if (!token) return;
    
    // For internal users, we'll bypass the normal accept flow and redirect them to Microsoft login
    const userType = inviteData?.userType || 'external';
    
    if (userType === 'internal') {
      try {
        // Just notify the user that they need to use Microsoft login
        toast({
          title: "Microsoft Account Required",
          description: "Your account has been created. Please use the Microsoft login button to sign in.",
        });
        
        // Redirect to the auth page
        setTimeout(() => {
          setLocation("/auth");
        }, 2000);
        return;
      } catch (err) {
        console.error("Error with internal user redirection:", err);
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
      return;
    }
    
    // For external users, continue with password validation and registration
    if (formData.password !== formData.confirmPassword) {
      form.setError("confirmPassword", {
        type: "manual",
        message: "Passwords don't match",
      });
      return;
    }

    try {
      setAcceptingInvite(true);

      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          username: formData.username,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept invitation");
      }

      toast({
        title: "Welcome to ADLink!",
        description: "Your account has been created successfully. You are now logged in.",
      });

      // Redirect to home after successful registration
      setTimeout(() => {
        setLocation("/");
      }, 1000);
    } catch (err) {
      console.error("Error accepting invitation:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to accept the invitation",
        variant: "destructive",
      });
    } finally {
      setAcceptingInvite(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Invitation Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => setLocation("/")}>
              Return to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!inviteData) {
    return null; // shouldn't happen, but just in case
  }

  // Determine user type and render appropriate UI
  const userType = inviteData.userType || 'external';
  const isInternalUser = userType === 'internal';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to ADLink</CardTitle>
          <CardDescription>
            {isInternalUser 
              ? "You've been invited as an internal user" 
              : "Complete your account setup"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 bg-muted p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <Mail className="h-5 w-5 mr-2 text-muted-foreground" />
              <span className="text-sm font-medium">{inviteData.email}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {inviteData.firstName} {inviteData.lastName}
              {inviteData.company ? ` • ${inviteData.company}` : ""}
            </p>
            <div className="mt-2 flex items-center">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                {inviteData.userType === 'internal' ? 'Internal User (Microsoft)' : 'External User'}
              </span>
              {inviteData.role === 'admin' && (
                <span className="ml-2 text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Administrator
                </span>
              )}
            </div>
          </div>

          {isInternalUser ? (
            // Internal user UI
            <div className="space-y-6">
              <Alert className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                <div className="flex items-center mb-2">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <AlertTitle>Microsoft Authentication Required</AlertTitle>
                </div>
                <AlertDescription>
                  As an internal user, you'll need to sign in with your Microsoft account. 
                  Your account has already been set up - just click the button below to continue.
                </AlertDescription>
              </Alert>
              
              <Button 
                type="button" 
                className="w-full" 
                onClick={() => {
                  toast({
                    title: "Redirecting to login",
                    description: "You'll be able to log in with Microsoft on the next screen.",
                  });
                  setTimeout(() => {
                    setLocation("/auth");
                  }, 1000);
                }}
              >
                Continue to Microsoft Login
              </Button>
            </div>
          ) : (
            // External user UI
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  rules={{ required: "Username is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  rules={{ 
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters"
                    }
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} autoComplete="new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  rules={{ required: "Please confirm your password" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} autoComplete="new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={acceptingInvite}>
                  {acceptingInvite ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}