import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PDFUploadDialog } from './pdf-upload-dialog';
import { FileIcon, Loader2, AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PDFDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUrlCreated?: () => void;
}

const pdfDocumentFormSchema = z.object({
  // Fields intentionally left empty as we don't need custom inputs
});

type PDFDocumentFormValues = z.infer<typeof pdfDocumentFormSchema>;

export function PDFDocumentDialog({ open, onOpenChange, onUrlCreated }: PDFDocumentDialogProps) {
  const { toast } = useToast();
  const [pdfFileData, setPdfFileData] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
  } | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }) => {
      const response = await apiRequest('POST', '/api/urls', data);

      return response;
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

    // Create a temporary URL object to properly format the URL
    const domainUrl = window.location.origin;
    const placeholderUrl = `${domainUrl}/pdf-document-url-${Date.now()}`;

    createUrlMutation.mutate({
      ...data,
      // Using a domain-based URL as originalUrl to satisfy schema validation
      // but we'll use isPdfDocument flag on server side for custom handling
      originalUrl: placeholderUrl,
      pdfDocumentUrl: pdfFileData.fileUrl,
      pdfDocumentName: pdfFileData.fileName,
      pdfDocumentSize: pdfFileData.fileSize,
      isPdfDocument: true
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
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
              
              <div className="space-y-4">
                {!pdfFileData ? (
                  <Button
                    type="button"
                    onClick={() => setShowUploadDialog(true)}
                    className="w-full h-32 border-dashed border-2"
                  >
                    Click to Upload PDF
                  </Button>
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
              </div>
              
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