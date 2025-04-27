import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PDFUploadDialog } from './pdf-upload-dialog';
import { FileIcon, Loader2, AlertCircle, X, Upload, FolderIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PDFDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUrlCreated?: () => void;
}

const pdfDocumentFormSchema = z.object({
  // Fields intentionally left empty as we don't need custom inputs
});

type PDFDocumentFormValues = z.infer<typeof pdfDocumentFormSchema>;

// Asset file type
interface AssetFile {
  id: number;
  userId: number;
  folderId: number | null;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  originalName: string;
  createdAt: string;
  updatedAt: string;
}

export function PDFDocumentDialog({ open, onOpenChange, onUrlCreated }: PDFDocumentDialogProps) {
  const { toast } = useToast();
  const [pdfFileData, setPdfFileData] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
  } | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upload");

  // Fetch user's asset files
  const { data: assetFiles, isLoading: isLoadingAssets } = useQuery({
    queryKey: ["/api/assets/files"],
    select: (data: any) => {
      if (!Array.isArray(data)) return [];
      return data.filter((file: AssetFile) => 
        file.fileType === "application/pdf" || 
        file.originalName?.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.pdf')
      );
    }
  });

  const form = useForm<PDFDocumentFormValues>({
    resolver: zodResolver(pdfDocumentFormSchema),
    defaultValues: {},
  });

  const createUrlMutation = useMutation({
    mutationFn: async (data: PDFDocumentFormValues & { 
      pdfDocumentUrl: string;
      pdfDocumentName: string;
      pdfDocumentSize: number;
      isPdfDocument: boolean;
      originalUrl: string;
    }) => {
      return apiRequest('/api/urls', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: 'PDF Document URL Created',
        description: 'Your PDF Document URL has been created successfully.',
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/urls'] });
      
      if (onUrlCreated) {
        onUrlCreated();
      }
      
      onOpenChange(false);
      form.reset();
      setPdfFileData(null);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
      setError(error.message);
    },
  });

  const handlePdfUploadComplete = (fileData: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
  }) => {
    setPdfFileData(fileData);
    setShowUploadDialog(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const onSubmit = (data: PDFDocumentFormValues) => {
    if (!pdfFileData) {
      setError('Please upload a PDF file');
      return;
    }

    // Use the Azure storage URL as the originalUrl
    // This ensures proper schema validation but the URL won't be directly accessed
    // Instead, our shortcode will serve the PDF through our custom viewer
    
    createUrlMutation.mutate({
      ...data,
      originalUrl: pdfFileData.fileUrl, // Use the actual PDF URL as originalUrl
      pdfDocumentUrl: pdfFileData.fileUrl,
      pdfDocumentName: pdfFileData.fileName,
      pdfDocumentSize: pdfFileData.fileSize,
      isPdfDocument: true
    });
  };

  // Handler to select a file from assets
  const handleAssetFileSelect = (file: AssetFile) => {
    setPdfFileData({
      fileUrl: file.fileUrl,
      fileName: file.originalName || file.name,
      fileSize: file.fileSize
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create PDF Document URL</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {!pdfFileData ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload New File
                    </TabsTrigger>
                    <TabsTrigger value="asset" className="flex items-center gap-2">
                      <FolderIcon className="h-4 w-4" />
                      Select from Assets
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="mt-4">
                    <Button
                      type="button"
                      onClick={() => setShowUploadDialog(true)}
                      className="w-full h-32 border-dashed border-2"
                    >
                      <Upload className="h-6 w-6 mr-2" />
                      Click to Upload PDF
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="asset" className="mt-4">
                    <div className="border rounded-md h-64 overflow-y-auto p-2">
                      {isLoadingAssets ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : !assetFiles || assetFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
                          <FileIcon className="h-12 w-12 mb-2 opacity-50" />
                          <p>No PDF files found in your assets</p>
                          <Button 
                            variant="link" 
                            onClick={() => setActiveTab("upload")}
                            className="mt-2"
                          >
                            Upload a new file instead
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {assetFiles.map((file: AssetFile) => (
                            <button
                              key={file.id}
                              type="button"
                              className="flex items-center gap-3 p-3 hover:bg-secondary rounded-md text-left transition-colors"
                              onClick={() => handleAssetFileSelect(file)}
                            >
                              <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{file.originalName || file.name}</p>
                                <p className="text-sm text-muted-foreground">{formatFileSize(file.fileSize)}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="relative bg-secondary p-4 rounded-md flex items-center gap-3">
                  <FileIcon className="h-12 w-12 text-primary" />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium truncate">{pdfFileData.fileName}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(pdfFileData.fileSize)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setPdfFileData(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={createUrlMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={!pdfFileData || createUrlMutation.isPending}
                >
                  {createUrlMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create PDF URL'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <PDFUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUploadComplete={handlePdfUploadComplete}
      />
    </>
  );
}