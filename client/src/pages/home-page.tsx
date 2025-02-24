import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUrlSchema, type InsertUrl, type Url, type QrConfig } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Copy, ExternalLink, LinkIcon, ChevronLeft, ChevronRight, Trash2, Download } from "lucide-react";
import { QrCustomizer } from "@/components/qr-customizer";
import { useState } from "react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { FiLock, FiUnlock } from "react-icons/fi";

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + "...";
}

export default function HomePage() {
  const { toast } = useToast();
  const domain = window.location.origin;
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const form = useForm<InsertUrl>({
    resolver: zodResolver(insertUrlSchema),
    defaultValues: { 
      originalUrl: "",
      password: "" 
    },
  });

  const { data, isLoading } = useQuery<{
    urls: Url[];
    pagination: { total: number; page: number; totalPages: number; hasMore: boolean; }
  }>({
    queryKey: ["/api/urls", page, ITEMS_PER_PAGE],
    queryFn: async () => {
      const res = await fetch(`/api/urls?page=${page}&limit=${ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error("Failed to fetch URLs");
      return res.json();
    },
  });

  const createUrlMutation = useMutation({
    mutationFn: async (data: InsertUrl) => {
      const res = await apiRequest("POST", "/api/urls", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      form.reset();
      toast({
        title: "URL shortened successfully",
        description: "Your new shortened URL is ready to use",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to shorten URL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUrlMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/urls/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      toast({
        title: "URL deleted",
        description: "The shortened URL has been deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete URL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password?: string }) => {
      const res = await apiRequest("PATCH", `/api/urls/${id}/password`, { password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      toast({
        title: "Password updated",
        description: "The URL password protection has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The URL has been copied to your clipboard",
    });
  };

  const urls = data?.urls || [];
  const { total = 0, totalPages = 1 } = data?.pagination || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-[400px,1fr]">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Shorten a URL</CardTitle>
                <CardDescription>
                  Enter a long URL to create a shortened version that's easier to share
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => {
                      const formData = {
                        ...data,
                        password: data.password || undefined
                      };
                      createUrlMutation.mutate(formData);
                    })}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="originalUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL to shorten</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password Protection (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Leave empty for no password" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createUrlMutation.isPending}
                    >
                      {createUrlMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Shorten URL
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      Total URLs
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {total}
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      Total Clicks
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {urls.reduce((sum, url) => sum + url.clicks, 0)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Shortened URLs</CardTitle>
              <CardDescription>
                Manage and track your shortened URLs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {urls.map((url) => {
                  const qrConfig = url.qrConfig as QrConfig;
                  return (
                    <div
                      key={url.id}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2 w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium break-all">
                              {`${domain}/api/r/${url.shortCode}`}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(`${domain}/api/r/${url.shortCode}`)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <a
                                href={`${domain}/api/r/${url.shortCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="icon">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete URL</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this shortened URL? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUrlMutation.mutate(url.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              Created: {format(new Date(url.createdAt), 'MMM d, yyyy HH:mm')}
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span>Clicks: {url.clicks}</span>
                          </div>
                          <p className="text-sm text-muted-foreground break-all">
                            Original: {url.originalUrl}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <div className="flex items-center gap-2">
                            <QRCodeSVG
                              id={`qr-${url.id}`}
                              value={`${domain}/api/r/${url.shortCode}`}
                              size={100}
                              level="H"
                              fgColor={qrConfig.fgColor}
                              bgColor={qrConfig.bgColor}
                              includeMargin={qrConfig.includeMargin}
                              imageSettings={
                                qrConfig.logoUrl
                                  ? {
                                      src: qrConfig.logoUrl,
                                      height: 24,
                                      width: 24,
                                      excavate: true,
                                    }
                                  : undefined
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const canvas = document.createElement("canvas");
                                const svgElement = document.getElementById(`qr-${url.id}`);
                                if (svgElement) {
                                  const svgData = new XMLSerializer().serializeToString(svgElement);
                                  const img = new Image();
                                  img.onload = () => {
                                    canvas.width = img.width;
                                    canvas.height = img.height;
                                    const ctx = canvas.getContext("2d");
                                    if (ctx) {
                                      ctx.fillStyle = qrConfig.bgColor;
                                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                                      ctx.drawImage(img, 0, 0);
                                      const pngFile = canvas.toDataURL("image/png");
                                      const downloadLink = document.createElement("a");
                                      downloadLink.download = `qr-${url.shortCode}.png`;
                                      downloadLink.href = pngFile;
                                      downloadLink.click();
                                    }
                                  };
                                  img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                          <QrCustomizer
                            url={`${domain}/api/r/${url.shortCode}`}
                            config={qrConfig}
                            onSave={async (newConfig) => {
                              try {
                                await apiRequest("PATCH", `/api/urls/${url.id}/qr-config`, newConfig);

                                queryClient.setQueryData<{ urls: Url[] }>(["/api/urls", page, ITEMS_PER_PAGE], (oldData) => {
                                  if (!oldData) return oldData;
                                  return {
                                    ...oldData,
                                    urls: oldData.urls.map((oldUrl) =>
                                      oldUrl.id === url.id ? { ...oldUrl, qrConfig: newConfig } : oldUrl
                                    )
                                  };
                                });

                                toast({
                                  title: "QR code updated",
                                  description: "Your QR code customization has been saved",
                                });
                              } catch (error) {
                                toast({
                                  title: "Failed to update QR code",
                                  description: error instanceof Error ? error.message : "An error occurred",
                                  variant: "destructive",
                                });
                              }
                            }}
                          />
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                              >
                                {url.isPasswordProtected ? (
                                  <FiLock className="h-4 w-4" />
                                ) : (
                                  <FiUnlock className="h-4 w-4" />
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-4">
                                <div className="font-medium">Password Protection</div>
                                {url.isPasswordProtected ? (
                                  <>
                                    <Input
                                      type="password"
                                      placeholder="Enter new password"
                                      className="mb-2"
                                      onChange={(e) => {
                                        (e.target as HTMLInputElement).dataset.newPassword = e.target.value;
                                      }}
                                    />
                                    <div className="flex justify-between gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => {
                                          updatePasswordMutation.mutate({
                                            id: url.id,
                                            password: undefined,
                                          });
                                        }}
                                      >
                                        Remove Password
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="flex-1"
                                        onClick={(e) => {
                                          const input = e.currentTarget.parentElement?.parentElement?.querySelector('input');
                                          const newPassword = input?.dataset.newPassword;
                                          if (newPassword) {
                                            updatePasswordMutation.mutate({
                                              id: url.id,
                                              password: newPassword,
                                            });
                                          }
                                        }}
                                      >
                                        Update Password
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Input
                                      type="password"
                                      placeholder="Enter password"
                                      className="mb-2"
                                      onChange={(e) => {
                                        (e.target as HTMLInputElement).dataset.newPassword = e.target.value;
                                      }}
                                    />
                                    <Button
                                      className="w-full"
                                      onClick={(e) => {
                                        const input = e.currentTarget.parentElement?.querySelector('input');
                                        const newPassword = input?.dataset.newPassword;
                                        if (newPassword) {
                                          updatePasswordMutation.mutate({
                                            id: url.id,
                                            password: newPassword,
                                          });
                                        }
                                      }}
                                    >
                                      Add Password Protection
                                    </Button>
                                  </>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                        </div>
                      </div>
                    </div>
                  );
                })}

                {urls.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No shortened URLs yet. Create your first one above!
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}