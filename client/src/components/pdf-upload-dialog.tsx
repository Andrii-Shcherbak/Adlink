import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, FileIcon, Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PDFUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: (fileData: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
  }) => void;
}

export function PDFUploadDialog({ open, onOpenChange, onUploadComplete }: PDFUploadDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files && e.target.files[0];
    
    // Reset error
    setError(null);
    
    if (!selectedFile) {
      return;
    }
    
    // Check if file is a PDF
    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      setFile(null);
      return;
    }
    
    // Check file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pdfFile', file);

      // Use fetch directly for FormData as apiRequest is designed for JSON
      const response = await fetch('/api/pdf-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      setIsUploading(false);
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Upload successful',
          description: 'PDF document uploaded successfully',
        });
        
        onUploadComplete({
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize
        });
        
        onOpenChange(false);
      } else {
        setError(data.message || 'Upload failed');
      }
    } catch (err) {
      setIsUploading(false);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'An error occurred during upload',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload PDF Document</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="pdf-file">Select PDF File</Label>
            <Input
              id="pdf-file"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
          
          {file && (
            <div className="bg-secondary p-3 rounded-md flex items-center gap-3">
              <FileIcon className="h-8 w-8 text-primary" />
              <div className="flex-1 overflow-hidden">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}