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
  FileText,
} from "lucide-react";
import { QrCustomizer } from "@/components/qr-customizer";
import { useState, useEffect } from "react";
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
      return apiRequest(`/api/urls/${id}/title`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
        headers: { 'Content-Type': 'application/json' }
      });
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
      const data = await apiRequest("/api/ai/generate-title", { 
        method: 'POST',
        body: JSON.stringify({ url: url.originalUrl }),
        headers: { 'Content-Type': 'application/json' }
      });
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
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
          <FiEdit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-gray-800/90 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Edit Title</DialogTitle>
          <DialogDescription className="text-white/70">
            Update the title for your shortened URL or generate one using AI.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="col-span-4 text-white/80">
              Title
            </Label>
            <div className="col-span-4 flex gap-2">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 bg-gray-700/50 border-white/10 text-white placeholder:text-white/30"
                placeholder="Enter a descriptive title"
              />
              <Button
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white"
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
          <Button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
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
      return apiRequest(`/api/urls/${id}/expiry`, {
        method: 'PATCH',
        body: JSON.stringify({ expiresAt }),
        headers: { 'Content-Type': 'application/json' }
      });
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
          className={url.expiresAt ? "text-amber-400" : "text-white/70 hover:text-white hover:bg-white/10"}
        >
          <Clock className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-gray-800/90 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Set Expiry Date</DialogTitle>
          <DialogDescription className="text-white/70">
            Choose when this link should expire. Expired links will no longer
            work.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              className={expiryDays === 1 
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white" 
                : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"}
              size="sm"
              onClick={() => setExpirationPeriod(1)}
            >
              1 Day
            </Button>
            <Button
              className={expiryDays === 7 
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white" 
                : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"}
              size="sm"
              onClick={() => setExpirationPeriod(7)}
            >
              7 Days
            </Button>
            <Button
              className={expiryDays === 30 
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white" 
                : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"}
              size="sm"
              onClick={() => setExpirationPeriod(30)}
            >
              30 Days
            </Button>
            <Button
              className={expiryDays === 90 
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white" 
                : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"}
              size="sm"
              onClick={() => setExpirationPeriod(90)}
            >
              90 Days
            </Button>
            <Button
              className={expiryDate === null 
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white" 
                : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"}
              size="sm"
              onClick={removeExpiration}
            >
              No Expiry
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-white/80">Custom Date</Label>
            <Input
              type="date"
              className="bg-gray-700/50 border-white/10 text-white"
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
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white/80">
              This link will expire on {format(expiryDate, "MMMM d, yyyy")}
              {isPast(expiryDate) && (
                <div className="mt-2 flex items-center text-red-400">
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
          <Button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
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
      return apiRequest(`/api/urls/${id}/destinations`, {
        method: 'PATCH',
        body: JSON.stringify({ isMultiDestination, destinations }),
        headers: { 'Content-Type': 'application/json' }
      });
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
            url.isMultiDestination ? "text-green-400" : "text-white/70 hover:text-white hover:bg-white/10"
          }
        >
          <Tablet className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-gray-800/90 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Multi-Platform Destinations</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your URL to redirect to different destinations based on
            the user's device type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="multi-destination" className="flex-1 text-white/80">
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
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Smartphone className="h-3 w-3 text-blue-400" />
                  </div>
                  <Label htmlFor="ios-url" className="font-medium text-white/80">
                    iOS Destination
                  </Label>
                </div>
                <Input
                  id="ios-url"
                  placeholder="https://example.com/ios"
                  className="bg-gray-700/50 border-white/10 text-white placeholder:text-white/30"
                  value={destinations.ios || ""}
                  onChange={(e) =>
                    handleDestinationChange("ios", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Smartphone className="h-3 w-3 text-green-400" />
                  </div>
                  <Label htmlFor="android-url" className="font-medium text-white/80">
                    Android Destination
                  </Label>
                </div>
                <Input
                  id="android-url"
                  placeholder="https://example.com/android"
                  className="bg-gray-700/50 border-white/10 text-white placeholder:text-white/30"
                  value={destinations.android || ""}
                  onChange={(e) =>
                    handleDestinationChange("android", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <Monitor className="h-3 w-3 text-violet-400" />
                  </div>
                  <Label htmlFor="desktop-url" className="font-medium text-white/80">
                    Desktop Destination
                  </Label>
                </div>
                <Input
                  id="desktop-url"
                  placeholder="https://example.com/desktop"
                  className="bg-gray-700/50 border-white/10 text-white placeholder:text-white/30"
                  value={destinations.desktop || ""}
                  onChange={(e) =>
                    handleDestinationChange("desktop", e.target.value)
                  }
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
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

export default function HomePage() {
  const { toast } = useToast();
  const domain = window.location.origin;
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [showPdfDocumentDialog, setShowPdfDocumentDialog] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Add a small delay to ensure smooth animation
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const {
    data: urlData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/urls"],
    select: (data) => {
      // Calculate the total number of pages
      const totalPages = Math.ceil(data.pagination.total / ITEMS_PER_PAGE);
      
      // Adjust page if it's out of bounds
      const validPage = Math.max(1, Math.min(page, totalPages));
      if (validPage !== page) {
        setPage(validPage);
      }
      
      return {
        urls: data.urls,
        pagination: {
          ...data.pagination,
          totalPages,
        },
      };
    },
  });

  // Add the insertUrlSchema with additional validation
  const enhancedInsertUrlSchema = insertUrlSchema.extend({
    originalUrl: insertUrlSchema.shape.originalUrl.refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch (e) {
          return false;
        }
      },
      {
        message: "Please enter a valid URL (including https://)",
      }
    ),
  });

  // Setup the form with react-hook-form
  const form = useForm<InsertUrl>({
    resolver: zodResolver(enhancedInsertUrlSchema),
    defaultValues: {
      originalUrl: "",
      shortCode: "",
    },
  });

  // Setup the mutation for creating a new URL
  const createUrlMutation = useMutation({
    mutationFn: async (values: InsertUrl) => {
      return apiRequest("/api/urls", {
        method: "POST",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: () => {
      // Show success toast
      toast({
        title: "URL shortened successfully",
        description: "Your URL has been shortened and is ready to use!",
      });
      // Reset the form
      form.reset();
      // Refetch URLs
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to shorten URL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler for form submission
  const onSubmit = (values: InsertUrl) => {
    createUrlMutation.mutate(values);
  };

  // Delete URL mutation
  const deleteUrlMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/urls/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      toast({
        title: "URL deleted",
        description: "The URL has been permanently deleted.",
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

  // Generate a random shortcode
  const generateRandomShortcode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    form.setValue("shortCode", result);
  };

  // AI shortcode suggestions feature
  const [showShortcodeSuggestions, setShowShortcodeSuggestions] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [shortcodeSuggestions, setShortcodeSuggestions] = useState<string[]>([]);

  const generateShortcodeSuggestions = async () => {
    const url = form.getValues("originalUrl");
    
    if (!url) {
      toast({
        title: "URL is required",
        description: "Please enter a URL to generate shortcode suggestions.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsGeneratingSuggestions(true);
      const data = await apiRequest("/api/ai/generate-shortcodes", { 
        method: 'POST',
        body: JSON.stringify({ url }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (data.shortcodes && data.shortcodes.length > 0) {
        setShortcodeSuggestions(data.shortcodes);
        setShowShortcodeSuggestions(true);
      } else {
        toast({
          title: "No suggestions available",
          description: "Unable to generate shortcode suggestions. Try a different URL or enter a custom shortcode.",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to generate suggestions",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const selectShortcodeSuggestion = (shortcode: string) => {
    form.setValue("shortCode", shortcode);
    setShowShortcodeSuggestions(false);
  };

  const handleCreatePdfDocument = () => {
    setShowPdfDocumentDialog(true);
  };

  // Calculate pagination information
  const startItem = (page - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(
    page * ITEMS_PER_PAGE,
    urlData?.pagination?.total || 0
  );
  const totalItems = urlData?.pagination?.total || 0;
  const totalPages = urlData?.pagination?.totalPages || 1;

  // Go to next page
  const nextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  // Go to previous page
  const prevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "URL copied",
          description: "The URL has been copied to your clipboard.",
        });
      },
      (err) => {
        toast({
          title: "Failed to copy",
          description: "Could not copy the URL to your clipboard.",
          variant: "destructive",
        });
      }
    );
  };

  if (isError) {
    return (
      <div className="relative z-10 transition-opacity duration-1000">
        <div className="bg-red-900/20 border border-red-800/60 rounded-xl p-6 mb-8 text-red-400 backdrop-blur-md shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Error Loading URLs</h2>
          <p>{error instanceof Error ? error.message : "An error occurred"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative z-10 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <div className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-2 bg-gradient-to-br from-gray-900/60 to-gray-900/40 border border-white/10 shadow-xl backdrop-blur-md rounded-xl overflow-hidden">
          {/* Subtle glow effects */}
          <div className="absolute -top-20 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl"></div>
          
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">Create New URL</CardTitle>
            <CardDescription className="text-white/70">
              Shorten a long URL or create a custom URL for easy sharing.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="originalUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/80">Original URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/very/long/url/that/needs/shortening"
                          className="bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shortCode"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-white/80">Custom Short Code (Optional)</FormLabel>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={generateRandomShortcode}
                            className="h-9 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg"
                            size="sm"
                          >
                            Random
                          </Button>
                          <Popover
                            open={showShortcodeSuggestions}
                            onOpenChange={setShowShortcodeSuggestions}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                onClick={generateShortcodeSuggestions}
                                className="h-9 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg flex items-center"
                                size="sm"
                                disabled={isGeneratingSuggestions}
                              >
                                {isGeneratingSuggestions ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <FiRefreshCw className="h-4 w-4 mr-2" />
                                )}
                                AI Suggestions
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 bg-gray-800/90 backdrop-blur-lg border-white/10 text-white">
                              <div className="space-y-4">
                                <h3 className="font-medium">Suggested Shortcodes</h3>
                                <div className="flex flex-wrap gap-2">
                                  {shortcodeSuggestions.map((code) => (
                                    <Badge
                                      key={code}
                                      className="cursor-pointer hover:bg-blue-500/30 bg-white/5 text-white border-white/10"
                                      onClick={() => selectShortcodeSuggestion(code)}
                                    >
                                      {code}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <FormControl>
                        <div className="flex rounded-lg overflow-hidden shadow-sm">
                          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-white/10 bg-gray-800/70 text-white/50 text-sm">
                            {domain}/
                          </span>
                          <Input
                            className="rounded-l-none bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="custom-code"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    className="h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg"
                    onClick={handleCreatePdfDocument}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create PDF Document URL
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUrlMutation.isPending}
                    className="min-w-[120px] h-10 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.02]"
                  >
                    {createUrlMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FiArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Create URL
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-900/60 to-gray-900/40 border border-white/10 shadow-xl backdrop-blur-md rounded-xl overflow-hidden">
          {/* Subtle glow effects */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl"></div>
          
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">URL Management</CardTitle>
            <CardDescription className="text-white/70">
              Manage your shortened URLs and track their performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h3 className="font-medium mb-4 text-white">Features</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FiBarChart2 className="h-4 w-4 text-blue-400" />
                  </div>
                  Track URL analytics and clicks
                </li>
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <FiEdit3 className="h-4 w-4 text-violet-400" />
                  </div>
                  Customize QR codes with logos
                </li>
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <FiClock className="h-4 w-4 text-green-400" />
                  </div>
                  Set URL expiration dates
                </li>
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <FiFile className="h-4 w-4 text-yellow-400" />
                  </div>
                  Create PDF document URLs
                </li>
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <div className="h-8 w-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                    <FiSmartphone className="h-4 w-4 text-pink-400" />
                  </div>
                  Set platform-specific destinations
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-6 text-white bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">Your URLs</h2>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="inline-flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-lg backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400 mr-2" />
              <span className="text-white/80">Loading your URLs...</span>
            </div>
          </div>
        ) : urlData?.urls && urlData.urls.length > 0 ? (
          <>
            <div className="space-y-6">
              {urlData.urls.map((url) => (
                <Card key={url.id} className="overflow-hidden bg-gradient-to-br from-gray-900/60 to-gray-900/40 border border-white/10 shadow-xl backdrop-blur-md rounded-xl">
                  <CardContent className="p-0">
                    <div className="p-6 flex flex-col md:flex-row gap-6">
                      {/* Left column - URL Info */}
                      <div className="md:flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-xl flex items-center gap-2 text-white">
                              {url.title || truncateUrl(url.originalUrl)}
                              <TitleEditDialog url={url} />
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-white/60 mb-2 flex-wrap">
                              <SecurityBadge url={url} />
                              <span>
                                Created {format(new Date(url.createdAt), "MMM d, yyyy")}
                              </span>
                              {url.clicks > 0 && <span>•</span>}
                              {url.clicks > 0 && (
                                <span className="font-medium text-blue-400">
                                  {url.clicks} {url.clicks === 1 ? "click" : "clicks"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex">
                            <ExpiryDialog url={url} />
                            <MultiDestinationDialog url={url} />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-gray-800/90 backdrop-blur-lg border-white/10 text-white">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete URL</AlertDialogTitle>
                                  <AlertDialogDescription className="text-white/70">
                                    Are you sure you want to delete this URL? This action
                                    cannot be undone and anyone with this link will no
                                    longer be able to access it.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-white/5 hover:bg-white/10 border border-white/10 text-white">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUrlMutation.mutate(url.id)}
                                    className="bg-red-600/80 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex gap-2 items-center">
                            <span className="text-sm font-medium text-white/80">Short URL:</span>
                            <div className="flex flex-1 items-center gap-1 min-w-0">
                              <code className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-mono overflow-x-auto whitespace-nowrap flex-1 text-blue-300">
                                {domain}/{url.shortCode}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-white/70 hover:text-white hover:bg-white/10"
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
                                <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          </div>
                          <div className="flex gap-2 items-center">
                            <span className="text-sm font-medium text-white/80">Original URL:</span>
                            <div className="flex flex-1 items-center gap-1 min-w-0">
                              <code className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-mono overflow-x-auto whitespace-nowrap flex-1 text-white/80">
                                {truncateUrl(url.originalUrl)}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-white/70 hover:text-white hover:bg-white/10"
                                onClick={() => copyToClipboard(url.originalUrl)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <a
                                href={url.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          </div>
                          
                          {/* Show platform-specific URLs if multi-destination is enabled */}
                          {url.isMultiDestination && url.destinations && (
                            <div className="mt-5 space-y-3 text-sm border-t border-white/10 pt-4">
                              <h4 className="font-medium mb-2 text-white/90">Platform-specific destinations:</h4>
                              {
                                (() => {
                                  // Parse destinations
                                  const destinations = typeof url.destinations === 'string'
                                    ? JSON.parse(url.destinations) as Destinations
                                    : url.destinations as Destinations;
                              
                                  return (
                                    <div className="space-y-2 bg-white/5 p-3 rounded-lg border border-white/10">
                                      {destinations.ios && (
                                        <div className="flex items-center gap-2 text-white/80">
                                          <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Smartphone className="h-3 w-3 text-blue-400" />
                                          </div>
                                          <span className="font-medium">iOS:</span>
                                          <span className="truncate flex-1">{destinations.ios}</span>
                                        </div>
                                      )}
                                      {destinations.android && (
                                        <div className="flex items-center gap-2 text-white/80">
                                          <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <Smartphone className="h-3 w-3 text-green-400" />
                                          </div>
                                          <span className="font-medium">Android:</span>
                                          <span className="truncate flex-1">{destinations.android}</span>
                                        </div>
                                      )}
                                      {destinations.desktop && (
                                        <div className="flex items-center gap-2 text-white/80">
                                          <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                                            <Monitor className="h-3 w-3 text-violet-400" />
                                          </div>
                                          <span className="font-medium">Desktop:</span>
                                          <span className="truncate flex-1">{destinations.desktop}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              }
                            </div>
                          )}
                          
                          {/* Expiry warning */}
                          {url.expiresAt && (
                            <div className={`mt-3 flex items-center gap-2 text-sm rounded-lg p-3 border ${
                              isPast(new Date(url.expiresAt))
                                ? "bg-red-500/10 border-red-500/30 text-red-400"
                                : isAfter(
                                    new Date(url.expiresAt),
                                    addDays(new Date(), 7)
                                  )
                                ? "bg-white/5 border-white/10 text-white/70"
                                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            }`}>
                              {isPast(new Date(url.expiresAt)) ? (
                                <>
                                  <div className="h-6 w-6 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <AlertTriangle className="h-3 w-3 text-red-400" />
                                  </div>
                                  <span>
                                    This URL expired{" "}
                                    {formatDistanceToNow(new Date(url.expiresAt), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Calendar className="h-3 w-3 text-blue-400" />
                                  </div>
                                  <span>
                                    Expires{" "}
                                    {format(new Date(url.expiresAt), "MMM d, yyyy")} (
                                    {formatDistanceToNow(new Date(url.expiresAt), {
                                      addSuffix: true,
                                    })}
                                    )
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* PDF indicator */}
                          {url.isPdfDocument && url.pdfDocumentUrl && (
                            <div className="mt-3 flex items-center gap-2 text-sm bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg p-3">
                              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <FileText className="h-3 w-3 text-blue-400" />
                              </div>
                              <span>PDF Document URL</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right column - QR Code */}
                      <div className="flex flex-col items-center justify-center min-w-[180px]">
                        <div className="bg-white rounded-lg p-3 mb-3 shadow-lg transform transition-transform hover:scale-105">
                          {url.qrConfig ? (
                            <QRCodeSVG
                              value={`${domain}/${url.shortCode}`}
                              size={120}
                              level="H"
                              includeMargin={false}
                              {...(typeof url.qrConfig === "string"
                                ? JSON.parse(url.qrConfig)
                                : url.qrConfig)}
                            />
                          ) : (
                            <QRCodeSVG
                              value={`${domain}/${url.shortCode}`}
                              size={120}
                              level="H"
                              includeMargin={false}
                            />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <QrCustomizer url={url} domain={domain} />
                          <Button
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg"
                            size="sm"
                            onClick={() => {
                              // Create a function to download the QR code
                              const svgElement = document.getElementById(
                                `qr-${url.id}`
                              );
                              if (svgElement) {
                                const svgData = new XMLSerializer().serializeToString(
                                  svgElement
                                );
                                const canvas = document.createElement("canvas");
                                const ctx = canvas.getContext("2d");
                                const img = new Image();
                                img.onload = () => {
                                  canvas.width = img.width;
                                  canvas.height = img.height;
                                  ctx!.drawImage(img, 0, 0);
                                  const pngFile = canvas.toDataURL("image/png");
                                  const downloadLink = document.createElement("a");
                                  downloadLink.download = `qr-${url.shortCode}.png`;
                                  downloadLink.href = pngFile;
                                  downloadLink.click();
                                };
                                img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
                              } else {
                                toast({
                                  title: "QR code not found",
                                  description:
                                    "Could not find the QR code to download.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Hidden QR code used for downloading */}
                        <div className="hidden">
                          <QRCodeSVG
                            id={`qr-${url.id}`}
                            value={`${domain}/${url.shortCode}`}
                            size={1024}
                            level="H"
                            includeMargin
                            {...(url.qrConfig
                              ? typeof url.qrConfig === "string"
                                ? JSON.parse(url.qrConfig)
                                : url.qrConfig
                              : {})}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <div className="text-sm text-white/50">
                  Showing {startItem}-{endItem} of {totalItems} URLs
                </div>
                <div className="flex gap-3 items-center">
                  <Button
                    className="h-9 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg"
                    size="sm"
                    onClick={prevPage}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-white/70">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    className="h-9 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg"
                    size="sm"
                    onClick={nextPage}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="bg-gradient-to-br from-gray-900/60 to-gray-900/40 border border-white/10 shadow-xl backdrop-blur-md rounded-xl overflow-hidden">
            {/* Subtle glow effects */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/5 rounded-full blur-3xl"></div>
            
            <CardContent className="flex flex-col items-center justify-center p-10 relative z-10">
              <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                <LinkIcon className="h-8 w-8 text-white/40" />
              </div>
              <h3 className="text-xl font-medium mb-3 text-white">No URLs yet</h3>
              <p className="text-white/60 text-center max-w-md">
                You haven't created any shortened URLs yet. Use the form above to
                create your first URL!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <PDFDocumentDialog
        open={showPdfDocumentDialog}
        onOpenChange={setShowPdfDocumentDialog}
        onUrlCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
        }}
      />
    </div>
  );
}