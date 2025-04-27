import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertUrlSchema,
  type InsertUrl,
  type Url,
  type QrConfig,
  type Destinations,
} from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2,
  Copy,
  ExternalLink,
  LinkIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Calendar,
  Clock,
  AlertTriangle,
  Smartphone,
  Monitor,
  Tablet,
} from "lucide-react";
import { QrCustomizer } from "@/components/qr-customizer";
import { useState } from "react";
import {
  format,
  addDays,
  isAfter,
  isPast,
  formatDistanceToNow,
} from "date-fns";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FiLock,
  FiUnlock,
  FiBarChart2,
  FiEdit2,
  FiEdit3,
  FiRefreshCw,
  FiArrowRight,
  FiCheck,
  FiClock,
  FiSmartphone,
  FiTablet,
  FiFile,
} from "react-icons/fi";
import { SecurityBadge } from "@/components/security-badge";
import { getUrlSecurityLevel, getSecurityColorClasses, cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PDFDocumentDialog } from "@/components/pdf-document-dialog";

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + "...";
}

// Title Edit Dialog Component
function TitleEditDialog({ url }: { url: Url }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(url.title || "");
  const [isGenerating, setIsGenerating] = useState(false);

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const res = await apiRequest("PATCH", `/api/urls/${id}/title`, { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      setIsOpen(false);
      toast({
        title: "Title updated",
        description: "The URL title has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update title",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateTitle = async () => {
    try {
      setIsGenerating(true);
      const res = await apiRequest("POST", "/api/ai/generate-title", {
        url: url.originalUrl,
      });
      const data = await res.json();
      setTitle(data.title);
    } catch (error) {
      toast({
        title: "Failed to generate title",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FiEdit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Title</DialogTitle>
          <DialogDescription>
            Update the title for your shortened URL or generate one using AI.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="col-span-4">
              Title
            </Label>
            <div className="col-span-4 flex gap-2">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
                placeholder="Enter a descriptive title"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={generateTitle}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FiRefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateTitleMutation.mutate({ id: url.id, title })}
            disabled={updateTitleMutation.isPending}
          >
            {updateTitleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FiCheck className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Expiry Date Dialog Component
function ExpiryDialog({ url }: { url: Url }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | null>(
    url.expiresAt ? new Date(url.expiresAt) : null,
  );
  const [expiryDays, setExpiryDays] = useState<number | null>(null);

  const updateExpiryMutation = useMutation({
    mutationFn: async ({
      id,
      expiresAt,
    }: {
      id: number;
      expiresAt: string | null;
    }) => {
      const res = await apiRequest("PATCH", `/api/urls/${id}/expiry`, {
        expiresAt,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      setIsOpen(false);
      toast({
        title: expiryDate ? "Expiry date set" : "Expiry date removed",
        description: expiryDate
          ? `The URL will expire on ${format(expiryDate, "MMM d, yyyy")}`
          : "The URL will not expire automatically",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update expiry date",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setExpirationPeriod = (days: number) => {
    setExpiryDays(days);
    setExpiryDate(addDays(new Date(), days));
  };

  const removeExpiration = () => {
    setExpiryDate(null);
    setExpiryDays(null);
  };

  const applyExpiration = () => {
    updateExpiryMutation.mutate({
      id: url.id,
      expiresAt: expiryDate ? expiryDate.toISOString() : null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={url.expiresAt ? "text-amber-500 dark:text-amber-400" : ""}
        >
          <Clock className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Expiry Date</DialogTitle>
          <DialogDescription>
            Choose when this link should expire. Expired links will no longer
            work.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={expiryDays === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setExpirationPeriod(1)}
            >
              1 Day
            </Button>
            <Button
              variant={expiryDays === 7 ? "default" : "outline"}
              size="sm"
              onClick={() => setExpirationPeriod(7)}
            >
              7 Days
            </Button>
            <Button
              variant={expiryDays === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setExpirationPeriod(30)}
            >
              30 Days
            </Button>
            <Button
              variant={expiryDays === 90 ? "default" : "outline"}
              size="sm"
              onClick={() => setExpirationPeriod(90)}
            >
              90 Days
            </Button>
            <Button
              variant={expiryDate === null ? "default" : "outline"}
              size="sm"
              onClick={removeExpiration}
            >
              No Expiry
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Custom Date</Label>
            <Input
              type="date"
              value={expiryDate ? format(expiryDate, "yyyy-MM-dd") : ""}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => {
                setExpiryDays(null);
                if (e.target.value) {
                  setExpiryDate(new Date(e.target.value));
                } else {
                  setExpiryDate(null);
                }
              }}
            />
          </div>

          {expiryDate && (
            <div className="rounded-md bg-muted p-3 text-sm">
              This link will expire on {format(expiryDate, "MMMM d, yyyy")}
              {isPast(expiryDate) && (
                <div className="mt-2 flex items-center text-destructive">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span>
                    This date is in the past. The link will be immediately
                    expired.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={applyExpiration}
            disabled={updateExpiryMutation.isPending}
          >
            {updateExpiryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FiCheck className="h-4 w-4 mr-2" />
            )}
            {expiryDate ? "Set Expiry" : "Remove Expiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Multi-Destination Dialog Component
function MultiDestinationDialog({ url }: { url: Url }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMultiDestination, setIsMultiDestination] = useState(
    !!url.isMultiDestination,
  );

  // Initialize destinations from URL or with empty values
  const initialDestinations = url.destinations
    ? typeof url.destinations === "string"
      ? JSON.parse(url.destinations)
      : url.destinations
    : { ios: "", android: "", desktop: "" };

  const [destinations, setDestinations] =
    useState<Destinations>(initialDestinations);

  const updateDestinationsMutation = useMutation({
    mutationFn: async ({
      id,
      isMultiDestination,
      destinations,
    }: {
      id: number;
      isMultiDestination: boolean;
      destinations: Destinations;
    }) => {
      const res = await apiRequest("PATCH", `/api/urls/${id}/destinations`, {
        isMultiDestination,
        destinations,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      setIsOpen(false);
      toast({
        title: isMultiDestination
          ? "Multi-destination enabled"
          : "Multi-destination disabled",
        description: isMultiDestination
          ? "Your QR code will now redirect to different URLs based on device type."
          : "Your QR code will now redirect to a single URL.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update destinations",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDestinationChange = (
    platform: keyof Destinations,
    value: string,
  ) => {
    setDestinations((prev) => ({
      ...prev,
      [platform]: value,
    }));
  };

  const handleSubmit = () => {
    // Validation
    if (isMultiDestination) {
      // Ensure at least one destination is set
      if (!destinations.ios && !destinations.android && !destinations.desktop) {
        toast({
          title: "Validation Error",
          description: "At least one platform destination must be provided",
          variant: "destructive",
        });
        return;
      }

      // Validate URLs
      for (const [platform, url] of Object.entries(destinations)) {
        if (url) {
          try {
            new URL(url);
          } catch (error) {
            toast({
              title: "Invalid URL",
              description: `The URL for ${platform} is not valid`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }

    updateDestinationsMutation.mutate({
      id: url.id,
      isMultiDestination,
      destinations,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            url.isMultiDestination ? "text-green-500 dark:text-green-400" : ""
          }
        >
          <Tablet className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Multi-Platform Destinations</DialogTitle>
          <DialogDescription>
            Configure your URL to redirect to different destinations based on
            the user's device type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="multi-destination" className="flex-1">
              Enable Multi-Destination
            </Label>
            <Switch
              id="multi-destination"
              checked={isMultiDestination}
              onCheckedChange={setIsMultiDestination}
            />
          </div>

          {isMultiDestination && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-500" />
                  <Label htmlFor="ios-url" className="font-medium">
                    iOS Destination
                  </Label>
                </div>
                <Input
                  id="ios-url"
                  placeholder="https://example.com/ios"
                  value={destinations.ios || ""}
                  onChange={(e) =>
                    handleDestinationChange("ios", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-500" />
                  <Label htmlFor="android-url" className="font-medium">
                    Android Destination
                  </Label>
                </div>
                <Input
                  id="android-url"
                  placeholder="https://example.com/android"
                  value={destinations.android || ""}
                  onChange={(e) =>
                    handleDestinationChange("android", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-purple-500" />
                  <Label htmlFor="desktop-url" className="font-medium">
                    Desktop Destination
                  </Label>
                </div>
                <Input
                  id="desktop-url"
                  placeholder="https://example.com/desktop"
                  value={destinations.desktop || ""}
                  onChange={(e) =>
                    handleDestinationChange("desktop", e.target.value)
                  }
                />
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  Leave a field empty to use the original URL as fallback for
                  that platform.
                </p>
                <p className="mt-1">
                  Original URL:{" "}
                  <span className="font-mono text-xs">{url.originalUrl}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateDestinationsMutation.isPending}
          >
            {updateDestinationsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FiCheck className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Shortcode Edit Dialog Component
function ShortcodeEditDialog({ url }: { url: Url }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [shortCode, setShortCode] = useState(url.shortCode);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const updateShortcodeMutation = useMutation({
    mutationFn: async ({
      id,
      shortCode,
    }: {
      id: number;
      shortCode: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/urls/${id}/shortcode`, {
        shortCode,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      setIsOpen(false);
      toast({
        title: "Shortcode updated",
        description: "The URL shortcode has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update shortcode",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateShortcodes = async () => {
    try {
      setIsGenerating(true);
      const res = await apiRequest("POST", "/api/ai/generate-shortcodes", {
        url: url.originalUrl,
        title: url.title || undefined,
        count: 5,
      });
      const data = await res.json();
      setSuggestions(data.shortcodes || []);
    } catch (error) {
      toast({
        title: "Failed to generate shortcodes",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FiEdit3 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Customize Shortcode</DialogTitle>
          <DialogDescription>
            Update the shortcode for your URL or get AI-generated suggestions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shortcode" className="col-span-4">
              Custom Shortcode
            </Label>
            <div className="col-span-4 flex gap-2">
              <Input
                id="shortcode"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                className="flex-1"
                placeholder="Enter a custom shortcode"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={generateShortcodes}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FiRefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <Label>AI Suggestions</Label>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setShortCode(suggestion)}
                    className="flex gap-1 items-center"
                  >
                    {suggestion}
                    <FiArrowRight className="h-3 w-3" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              updateShortcodeMutation.mutate({ id: url.id, shortCode })
            }
            disabled={updateShortcodeMutation.isPending}
          >
            {updateShortcodeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FiCheck className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HomePage() {
  const { toast } = useToast();
  const domain = window.location.origin;
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [showPdfDocumentDialog, setShowPdfDocumentDialog] = useState(false);

  const form = useForm<InsertUrl>({
    resolver: zodResolver(insertUrlSchema),
    defaultValues: {
      originalUrl: "",
      password: "",
    },
  });

  const { data, isLoading } = useQuery<{
    urls: Url[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      hasMore: boolean;
    };
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
      const res = await apiRequest("PATCH", `/api/urls/${id}/password`, {
        password,
      });
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
            <Card className="overflow-hidden border-0 shadow-lg">
              <div className="bg-gradient-to-r from-primary/90 to-indigo-500/90 p-6 text-white">
                <h2 className="text-2xl font-bold">Shorten a URL</h2>
                <p className="text-white/80 mt-1">
                  Create shortened links with powerful features
                </p>
              </div>
              <CardContent className="p-6 pt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => {
                      const formData = {
                        ...data,
                        password: data.password || undefined,
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
                            <Input
                              placeholder="https://example.com"
                              {...field}
                            />
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
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full flex items-center gap-2"
                    onClick={() => setShowPdfDocumentDialog(true)}
                  >
                    <FiFile className="h-4 w-4" />
                    Create PDF Document URL
                  </Button>
                </div>
              </CardContent>
            </Card>

            <PDFDocumentDialog
              open={showPdfDocumentDialog}
              onOpenChange={setShowPdfDocumentDialog}
              onUrlCreated={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
              }}
            />

            <Card className="overflow-hidden border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-primary/10 to-indigo-500/10 rounded-lg p-5 transition-all hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/20 text-primary rounded-full p-2">
                        <LinkIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Total URLs
                        </div>
                        <div className="text-2xl font-bold mt-1">{total}</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-500/10 to-primary/10 rounded-lg p-5 transition-all hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500/20 text-indigo-500 rounded-full p-2">
                        <FiBarChart2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Total Clicks
                        </div>
                        <div className="text-2xl font-bold mt-1">
                          {urls.reduce((sum, url) => sum + url.clicks, 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-indigo-500/90 to-primary/90 p-6 text-white">
              <h2 className="text-2xl font-bold">Your Shortened URLs</h2>
              <p className="text-white/80 mt-1">
                Manage and track all your links in one place
              </p>
            </div>
            <CardContent className="p-6">
              <div className="space-y-6">
                {urls.map((url) => {
                  const qrConfig = url.qrConfig as QrConfig;
                  const securityLevel = getUrlSecurityLevel(url);
                  const securityColors = getSecurityColorClasses(securityLevel);

                  return (
                    <div
                      key={url.id}
                      className={cn(
                        "p-5 rounded-lg border shadow-sm transition-all hover:shadow-md",
                        securityColors.border,
                      )}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2 w-full">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 flex-grow">
                              <span className="font-medium break-all">
                                {`${domain}/${url.shortCode}`}
                              </span>
                              <SecurityBadge level={securityLevel} />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  copyToClipboard(`${domain}/${url.shortCode}`)
                                }
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <a
                                href={`${domain}/${url.shortCode}`}
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
                                    <AlertDialogTitle>
                                      Delete URL
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this
                                      shortened URL? This action cannot be
                                      undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deleteUrlMutation.mutate(url.id)
                                      }
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            <span>
                              Created:{" "}
                              {format(
                                new Date(url.createdAt),
                                "MMM d, yyyy HH:mm",
                              )}
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span>Clicks: {url.clicks}</span>
                            {url.expiresAt && (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <span className="flex items-center gap-1">
                                  <FiClock className="h-3 w-3" />
                                  {isPast(new Date(url.expiresAt)) ? (
                                    <Badge
                                      variant="destructive"
                                      className="text-xs py-0 h-5"
                                    >
                                      Expired
                                    </Badge>
                                  ) : (
                                    <span>
                                      Expires:{" "}
                                      {formatDistanceToNow(
                                        new Date(url.expiresAt),
                                        { addSuffix: true },
                                      )}
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Title display with edit option */}
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {url.title ? (
                                <span>{url.title}</span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  No title
                                </span>
                              )}
                            </p>
                            <TitleEditDialog url={url} />
                          </div>

                          <p className="text-sm text-muted-foreground break-all">
                            Original: {url.originalUrl}
                          </p>

                          {/* Custom Shortcode Edit */}
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Short Code:</span>{" "}
                              {url.shortCode}
                            </p>
                            <ShortcodeEditDialog url={url} />
                          </div>

                          {/* Multi-destination indicator */}
                          {url.isMultiDestination && (
                            <div className="mt-2 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                              >
                                <Tablet className="h-3 w-3 mr-1" />
                                Multi-Device URL
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <div className="flex items-center gap-2">
                            <QRCodeSVG
                              id={`qr-${url.id}`}
                              value={`${domain}/${url.shortCode}`}
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
                                const svgElement = document.getElementById(
                                  `qr-${url.id}`,
                                );
                                if (svgElement) {
                                  const svgData =
                                    new XMLSerializer().serializeToString(
                                      svgElement,
                                    );
                                  const img = new Image();
                                  img.onload = () => {
                                    canvas.width = img.width;
                                    canvas.height = img.height;
                                    const ctx = canvas.getContext("2d");
                                    if (ctx) {
                                      ctx.fillStyle = qrConfig.bgColor;
                                      ctx.fillRect(
                                        0,
                                        0,
                                        canvas.width,
                                        canvas.height,
                                      );
                                      ctx.drawImage(img, 0, 0);
                                      const pngFile =
                                        canvas.toDataURL("image/png");
                                      const downloadLink =
                                        document.createElement("a");
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
                            url={`${domain}/${url.shortCode}`}
                            config={qrConfig}
                            onSave={async (newConfig) => {
                              try {
                                await apiRequest(
                                  "PATCH",
                                  `/api/urls/${url.id}/qr-config`,
                                  newConfig,
                                );

                                queryClient.setQueryData<{ urls: Url[] }>(
                                  ["/api/urls", page, ITEMS_PER_PAGE],
                                  (oldData) => {
                                    if (!oldData) return oldData;
                                    return {
                                      ...oldData,
                                      urls: oldData.urls.map((oldUrl) =>
                                        oldUrl.id === url.id
                                          ? { ...oldUrl, qrConfig: newConfig }
                                          : oldUrl,
                                      ),
                                    };
                                  },
                                );

                                toast({
                                  title: "QR code updated",
                                  description:
                                    "Your QR code customization has been saved",
                                });
                              } catch (error) {
                                toast({
                                  title: "Failed to update QR code",
                                  description:
                                    error instanceof Error
                                      ? error.message
                                      : "An error occurred",
                                  variant: "destructive",
                                });
                              }
                            }}
                          />
                          {/* Multi Destination Button */}
                          <MultiDestinationDialog url={url} />

                          {/* Expiry Date Button */}
                          <ExpiryDialog url={url} />

                          {/* Password Protection Button */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon">
                                {url.isPasswordProtected ? (
                                  <FiLock className="h-4 w-4" />
                                ) : (
                                  <FiUnlock className="h-4 w-4" />
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-4">
                                <div className="font-medium">
                                  Password Protection
                                </div>
                                {url.isPasswordProtected ? (
                                  <>
                                    <Input
                                      type="password"
                                      placeholder="Enter new password"
                                      className="mb-2"
                                      onChange={(e) => {
                                        (
                                          e.target as HTMLInputElement
                                        ).dataset.newPassword = e.target.value;
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
                                          const input =
                                            e.currentTarget.parentElement?.parentElement?.querySelector(
                                              "input",
                                            );
                                          const newPassword =
                                            input?.dataset.newPassword;
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
                                        (
                                          e.target as HTMLInputElement
                                        ).dataset.newPassword = e.target.value;
                                      }}
                                    />
                                    <Button
                                      className="w-full"
                                      onClick={(e) => {
                                        const input =
                                          e.currentTarget.parentElement?.querySelector(
                                            "input",
                                          );
                                        const newPassword =
                                          input?.dataset.newPassword;
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
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
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
