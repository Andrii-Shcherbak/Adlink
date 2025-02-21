import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUrlSchema, type InsertUrl, type Url } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Copy, ExternalLink, LinkIcon } from "lucide-react";
import { QrCustomizer } from "@/components/qr-customizer";

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + "...";
}

export default function HomePage() {
  const { toast } = useToast();
  const domain = window.location.origin;

  const form = useForm<InsertUrl>({
    resolver: zodResolver(insertUrlSchema),
    defaultValues: { originalUrl: "" },
  });

  const { data: urls = [], isLoading } = useQuery<Url[]>({
    queryKey: ["/api/urls"],
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

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The URL has been copied to your clipboard",
    });
  };

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
                    onSubmit={form.handleSubmit((data) => createUrlMutation.mutate(data))}
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
                      {urls.length}
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
                {urls.map((url) => (
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
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground break-all">
                          Original: {url.originalUrl}
                        </p>
                        <div className="text-sm text-muted-foreground">
                          Clicks: {url.clicks}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <QRCodeSVG
                          value={`${domain}/api/r/${url.shortCode}`}
                          size={100}
                          level="H"
                          {...url.qrConfig}
                          imageSettings={
                            url.qrConfig.logoUrl
                              ? {
                                  src: url.qrConfig.logoUrl,
                                  height: 24,
                                  width: 24,
                                  excavate: true,
                                }
                              : undefined
                          }
                        />
                        <QrCustomizer
                          url={`${domain}/api/r/${url.shortCode}`}
                          config={url.qrConfig}
                          onSave={async (newConfig) => {
                            try {
                              await apiRequest("PATCH", `/api/urls/${url.id}/qr-config`, newConfig);

                              queryClient.setQueryData<Url[]>(["/api/urls"], (oldUrls) => {
                                if (!oldUrls) return oldUrls;
                                return oldUrls.map((oldUrl) =>
                                  oldUrl.id === url.id ? { ...oldUrl, qrConfig: newConfig } : oldUrl
                                );
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}