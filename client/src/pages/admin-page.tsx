import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Database, RefreshCcw, Mail, User as UserIcon, UserCog, Trash2 } from "lucide-react";
import type { User } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { queryClient } from "@/lib/queryClient";
import { getAppUrl } from "@/lib/appConfig";
import { useAuthProviders } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CreateUserForm = {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
};

type InviteUserForm = {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  userType: 'internal' | 'external';
  role: 'admin' | 'user';
};

export default function AdminPage() {
  const { toast } = useToast();
  const authProviders = useAuthProviders();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteDialogData, setInviteDialogData] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    inviteUrl: string;
    warning: string;
  } | null>(null);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(
      z.object({
        username: z.string().min(3, "Username must be at least 3 characters"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        email: z.string().email("Please enter a valid email"),
        firstName: z.string().min(2, "First name must be at least 2 characters"),
        lastName: z.string().min(2, "Last name must be at least 2 characters"),
        company: z.string().optional(),
      })
    ),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      company: "",
    },
  });

  const inviteForm = useForm<InviteUserForm>({
    resolver: zodResolver(
      z.object({
        email: z.string().email("Please enter a valid email"),
        firstName: z.string().min(2, "First name must be at least 2 characters"),
        lastName: z.string().min(2, "Last name must be at least 2 characters"),
        company: z.string().optional(),
        userType: z.enum(['internal', 'external']),
        role: z.enum(['admin', 'user']),
      })
    ),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      company: '',
      userType: 'external',
      role: 'user'
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, isApproved, isActive }: { userId: number; isApproved: boolean; isActive: boolean }) => {
      const res = await fetch(`/api/admin/users/${userId}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved, isActive }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      
      // For successful responses (200-299), just return success
      if (res.ok) {
        return { success: true };
      }
      
      // For error responses, use the server's message when there is one
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error || "Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const migrateAnalyticsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/migrate-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("Failed to migrate analytics data");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Analytics Migration Successful",
        description: data.message || "Analytics data has been migrated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Migration Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Invitation mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteUserForm) => {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send invitation");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      inviteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      
      if (data.warning) {
        // Show a toast with the warning and invite link for manual sharing
        const baseUrl = getAppUrl();
        const inviteUrl = `${baseUrl}/invite/${data.token}`;
        
        // Use a dialog instead of a toast for better invitation management
        setInviteDialogData({
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          inviteUrl: inviteUrl,
          warning: data.warning
        });
        setShowInviteDialog(true);
      } else {
        toast({
          title: "Success",
          description: "Invitation sent successfully",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };
  
  const onInviteSubmit = (data: InviteUserForm) => {
    inviteUserMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Invite Link Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitation Created - Email Not Sent</DialogTitle>
          </DialogHeader>
          
          {inviteDialogData && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded border border-amber-200 dark:border-amber-800">
                <p className="text-amber-700 dark:text-amber-400 text-sm">{inviteDialogData.warning}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Invitation Details</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="font-medium">Name:</dt>
                  <dd>{inviteDialogData.firstName} {inviteDialogData.lastName}</dd>
                  <dt className="font-medium">Email:</dt>
                  <dd>{inviteDialogData.email}</dd>
                </dl>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Invitation Link</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Share this link with the user to complete their registration
                </p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={inviteDialogData.inviteUrl}
                    readOnly
                    className="text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteDialogData.inviteUrl);
                      toast({
                        title: "Copied",
                        description: "Invitation link copied to clipboard",
                        duration: 2000,
                      });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              
              <div className="bg-muted/50 p-3 rounded">
                <h3 className="text-sm font-medium mb-1">Email Subject</h3>
                <p className="text-xs">Invitation to join ADLink</p>
                
                <h3 className="text-sm font-medium mt-3 mb-1">Email Preview</h3>
                <div className="bg-background p-2 rounded text-xs">
                  <p>Hello {inviteDialogData.firstName} {inviteDialogData.lastName},</p>
                  <p className="mt-1">You have been invited to join ADLink, a robust URL shortening and QR code generation platform.</p>
                  <p className="mt-1">To accept this invitation, please visit the link that was sent to you.</p>
                  <p className="mt-1">This invitation will expire in 7 days.</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="space-y-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>System Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Migrate Analytics Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Migrate Analytics Data</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will update the analytics data format for all URLs. This operation is necessary if you're seeing issues with country or city data visualization. Continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => migrateAnalyticsMutation.mutate()}
                      disabled={migrateAnalyticsMutation.isPending}
                    >
                      {migrateAnalyticsMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Start Migration
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <div className="flex gap-2">
            {/* Add User button has been removed as requested */}
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                </DialogHeader>
                <Form {...inviteForm}>
                  <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                    <FormField
                      control={inviteForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={inviteForm.control}
                      name="userType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User Type</FormLabel>
                          <div className="border rounded-md p-3 space-y-3">
                            <FormDescription>
                              Select the type of user account
                            </FormDescription>
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex items-center space-x-2">
                                <input 
                                  type="radio" 
                                  id="userType-internal" 
                                  value="internal" 
                                  checked={field.value === 'internal'}
                                  onChange={() => field.onChange('internal')}
                                  disabled={!authProviders.microsoft}
                                  className="h-4 w-4 text-primary border-muted-foreground"
                                />
                                <label htmlFor="userType-internal" className={`text-sm font-medium leading-none ${authProviders.microsoft ? "cursor-pointer" : "text-muted-foreground"}`}>
                                  Internal (Microsoft Login){!authProviders.microsoft && " — Microsoft sign-in not configured"}
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input 
                                  type="radio" 
                                  id="userType-external" 
                                  value="external" 
                                  checked={field.value === 'external'}
                                  onChange={() => field.onChange('external')}
                                  className="h-4 w-4 text-primary border-muted-foreground"
                                />
                                <label htmlFor="userType-external" className="text-sm font-medium leading-none cursor-pointer">
                                  External (Password Login)
                                </label>
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User Role</FormLabel>
                          <div className="border rounded-md p-3 space-y-3">
                            <FormDescription>
                              Select the user's permission level
                            </FormDescription>
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex items-center space-x-2">
                                <input 
                                  type="radio" 
                                  id="role-user" 
                                  value="user" 
                                  checked={field.value === 'user'}
                                  onChange={() => field.onChange('user')}
                                  className="h-4 w-4 text-primary border-muted-foreground"
                                />
                                <label htmlFor="role-user" className="text-sm font-medium leading-none cursor-pointer">
                                  Regular User
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input 
                                  type="radio" 
                                  id="role-admin" 
                                  value="admin" 
                                  checked={field.value === 'admin'}
                                  onChange={() => field.onChange('admin')}
                                  className="h-4 w-4 text-primary border-muted-foreground"
                                />
                                <label htmlFor="role-admin" className="text-sm font-medium leading-none cursor-pointer">
                                  Administrator
                                </label>
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-2">
                      <Button type="submit" disabled={inviteUserMutation.isPending} className="w-full">
                        {inviteUserMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Send Invitation
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="grid gap-4">
          {users?.map((user) => (
            <Card key={user.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">
                  {user.firstName} {user.lastName}
                </CardTitle>
                {user.role !== "admin" && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={(isActive) =>
                          updateUserMutation.mutate({
                            userId: user.id,
                            isActive,
                            isApproved: user.isApproved,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Approved</span>
                      <Switch
                        checked={user.isApproved}
                        onCheckedChange={(isApproved) =>
                          updateUserMutation.mutate({
                            userId: user.id,
                            isApproved,
                            isActive: user.isActive,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {user.username && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Username:</span> {user.username}
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email:</span> {user.email}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Role:</span>{" "}
                    <span className="capitalize">{user.role}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span className="capitalize">{user.userType || "external"}</span>
                    {user.microsoftId && (
                      <span className="ml-1 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                        Microsoft
                      </span>
                    )}
                  </div>
                  {user.company && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Company:</span> {user.company}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete User
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                      <AlertDialogDescription>
                        {user.role === "admin" ? (
                          <>
                            <p className="mb-2 font-semibold text-destructive">Warning: You are about to delete an admin user.</p>
                            <p>Are you sure you want to delete {user.firstName} {user.lastName}? This action cannot be undone and will delete all of their links and data.</p>
                          </>
                        ) : (
                          <>Are you sure you want to delete {user.firstName} {user.lastName}? This action cannot be undone and will delete all of their links and data.</>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteUserMutation.mutate(user.id)}
                        disabled={deleteUserMutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteUserMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}