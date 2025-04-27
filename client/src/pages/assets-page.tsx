import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Folder, File, Upload, Plus, X, PenSquare, Trash } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// Define folder creation form schema
const folderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100, "Folder name is too long"),
  parentId: z.number().nullable().optional(),
});

// Define file upload form schema
const fileSchema = z.object({
  name: z.string().min(1, "File name is required").max(100, "File name is too long"),
  folderId: z.number().nullable().optional(),
  description: z.string().optional(),
});

type FolderFormValues = z.infer<typeof folderSchema>;
type FileFormValues = z.infer<typeof fileSchema>;

// Types for API responses
interface Folder {
  id: number;
  name: string;
  userId: number;
  parentId: number | null;
  path: string;
  createdAt: string;
  updatedAt: string;
}

interface File {
  id: number;
  name: string;
  userId: number;
  folderId: number | null;
  originalName: string;
  fileUrl: string;
  storageFileName: string;
  fileType: string;
  fileSize: number;
  contentType: string;
  description: string | null;
  secureUrl: string; // URL with SAS token
  createdAt: string;
  updatedAt: string;
}

// Component to display a folder
const FolderItem: React.FC<{ 
  folder: Folder; 
  onSelect: (folder: Folder) => void;
  onDelete: (id: number) => void;
  onRename: (folder: Folder) => void;
}> = ({ folder, onSelect, onDelete, onRename }) => {
  return (
    <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3" onClick={() => onSelect(folder)}>
          <Folder className="h-8 w-8 text-blue-500" />
          <div>
            <h3 className="font-medium">{folder.name}</h3>
          </div>
        </div>
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" onClick={(e) => {
            e.stopPropagation();
            onRename(folder);
          }}>
            <PenSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => {
            e.stopPropagation();
            onDelete(folder.id);
          }}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Component to display a file
const FileItem: React.FC<{ 
  file: File; 
  onDelete: (id: number) => void;
  onRename: (file: File) => void;
}> = ({ file, onDelete, onRename }) => {
  const getIconByType = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type === 'application/pdf') return '📄';
    return '📁';
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">
            {getIconByType(file.contentType)}
          </div>
          <div>
            <h3 className="font-medium">{file.name}</h3>
            <p className="text-sm text-gray-500">{formatFileSize(file.fileSize)}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" asChild>
            <a href={file.secureUrl} target="_blank" rel="noopener noreferrer">View</a>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onRename(file)}>
            <PenSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(file.id)}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// New folder dialog
const NewFolderDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolder: Folder | null;
  isEditing: boolean;
  folderToEdit: Folder | null;
}> = ({ open, onOpenChange, currentFolder, isEditing, folderToEdit }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: {
      name: folderToEdit?.name || '',
      parentId: isEditing ? folderToEdit?.parentId : (currentFolder?.id || null),
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: FolderFormValues) => {
      // Add required path field with default value, server will calculate the correct path
      return apiRequest('/api/assets/folders', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          path: '/', // Default path, will be overridden by server logic
        }),
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets/folders'] });
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create folder: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async (data: { id: number, name: string, parentId: number | null }) => {
      return apiRequest(`/api/assets/folders/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name,
          parentId: data.parentId,
        }),
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets/folders'] });
      toast({
        title: "Success",
        description: "Folder updated successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update folder: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FolderFormValues) => {
    if (isEditing && folderToEdit) {
      updateFolderMutation.mutate({
        id: folderToEdit.id,
        name: data.name,
        parentId: data.parentId,
      });
    } else {
      // Add path to the data we're sending
      createFolderMutation.mutate({
        ...data,
        path: '/', // Default path that server will override
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Folder' : 'Create New Folder'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update folder information'
              : currentFolder 
                ? `Create a new folder inside "${currentFolder.name}"`
                : 'Create a new folder in the root directory'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Folder" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button 
                type="submit"
                disabled={createFolderMutation.isPending || updateFolderMutation.isPending}
              >
                {isEditing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// File upload dialog
const FileUploadDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolder: Folder | null;
  isEditing: boolean;
  fileToEdit: File | null;
}> = ({ open, onOpenChange, currentFolder, isEditing, fileToEdit }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  
  const form = useForm<FileFormValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: {
      name: fileToEdit?.name || '',
      folderId: isEditing ? fileToEdit?.folderId : (currentFolder?.id || null),
      description: fileToEdit?.description || '',
    },
  });

  const fileUploadMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/assets/files', {
        method: 'POST',
        body: data,
        customConfig: { isFormData: true },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets/files'] });
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
      onOpenChange(false);
      form.reset();
      setFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to upload file: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async (data: { id: number, name: string, folderId: number | null, description: string | null }) => {
      return apiRequest(`/api/assets/files/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name,
          folderId: data.folderId,
          description: data.description,
        }),
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets/files'] });
      toast({
        title: "Success",
        description: "File updated successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update file: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FileFormValues) => {
    if (isEditing && fileToEdit) {
      updateFileMutation.mutate({
        id: fileToEdit.id,
        name: data.name,
        folderId: data.folderId,
        description: data.description || null,
      });
    } else {
      // Create form data for file upload
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.folderId !== undefined && data.folderId !== null) {
        formData.append('folderId', data.folderId.toString());
      }
      if (data.description) {
        formData.append('description', data.description);
      }
      
      // Add file to form data
      const fileInput = document.getElementById('file') as HTMLInputElement;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
        fileUploadMutation.mutate(formData);
      } else {
        toast({
          title: "Error",
          description: "Please select a file to upload",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // If no name is set yet, use the file name
      if (!form.getValues('name')) {
        form.setValue('name', file.name.split('.')[0]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit File' : 'Upload File'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update file information'
              : currentFolder 
                ? `Upload a file to the folder "${currentFolder.name}"`
                : 'Upload a file to the root directory'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My File" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {!isEditing && (
              <FormItem>
                <FormLabel htmlFor="file">File</FormLabel>
                <FormControl>
                  <Input 
                    id="file" 
                    type="file" 
                    onChange={handleFileChange}
                    accept="image/*,application/pdf,video/*,audio/*,text/plain,text/csv,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  />
                </FormControl>
                <FormDescription>
                  Select a file to upload. Maximum size: 50MB.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="File description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="submit"
                disabled={fileUploadMutation.isPending || updateFileMutation.isPending}
              >
                {isEditing ? 'Update' : 'Upload'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Breadcrumb navigation
const FolderBreadcrumb: React.FC<{
  currentPath: { id: number | null, name: string }[];
  onNavigate: (id: number | null) => void;
}> = ({ currentPath, onNavigate }) => {
  return (
    <div className="flex items-center text-sm mb-4 overflow-x-auto">
      {currentPath.map((folder, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="mx-2">/</span>}
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => onNavigate(folder.id)}
          >
            {folder.name}
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
};

// Main Assets Management page component
export default function AssetsPage() {
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [folderPath, setFolderPath] = useState<{ id: number | null, name: string }[]>([
    { id: null, name: 'Root' }
  ]);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folders
  const { 
    data: folders = [], 
    isLoading: foldersLoading 
  } = useQuery({
    queryKey: ['/api/assets/folders'],
    queryFn: async () => {
      const response = await apiRequest('/api/assets/folders');
      return Array.isArray(response) ? response : [];
    },
  });

  // Fetch files for the current folder
  const { 
    data: files = [], 
    isLoading: filesLoading 
  } = useQuery({
    queryKey: ['/api/assets/files', currentFolder?.id],
    queryFn: async () => {
      const response = await apiRequest(`/api/assets/files${currentFolder ? `?folderId=${currentFolder.id}` : '?folderId=null'}`);
      return Array.isArray(response) ? response : [];
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/assets/folders/${id}`, {
        method: 'DELETE',
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets/folders'] });
      toast({
        title: "Success",
        description: "Folder deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete folder: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/assets/files/${id}`, {
        method: 'DELETE',
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets/files'] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete file: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Handle folder navigation
  const handleFolderSelect = (folder: Folder) => {
    setCurrentFolder(folder);
    // Update breadcrumb path
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = (id: number | null) => {
    if (id === null) {
      // Navigate to root
      setCurrentFolder(null);
      setFolderPath([{ id: null, name: 'Root' }]);
    } else {
      // Find the folder in our data
      const folder = folders.find((f: Folder) => f.id === id);
      if (folder) {
        setCurrentFolder(folder);
        // Update breadcrumb path - find the index and slice
        const index = folderPath.findIndex(item => item.id === id);
        if (index !== -1) {
          setFolderPath(folderPath.slice(0, index + 1));
        }
      }
    }
  };

  // Handle folder deletion
  const handleDeleteFolder = (id: number) => {
    if (confirm('Are you sure you want to delete this folder? This action cannot be undone.')) {
      deleteFolderMutation.mutate(id);
    }
  };

  // Handle file deletion
  const handleDeleteFile = (id: number) => {
    if (confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      deleteFileMutation.mutate(id);
    }
  };

  // Start folder editing
  const handleEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
    setFolderDialogOpen(true);
  };

  // Start file editing
  const handleEditFile = (file: File) => {
    setEditingFile(file);
    setFileDialogOpen(true);
  };

  // Reset dialogs when closed
  const handleFolderDialogClose = (open: boolean) => {
    setFolderDialogOpen(open);
    if (!open) {
      setEditingFolder(null);
    }
  };

  const handleFileDialogClose = (open: boolean) => {
    setFileDialogOpen(open);
    if (!open) {
      setEditingFile(null);
    }
  };

  // Filter only folders in the current folder
  const currentFolders = folders.filter((folder: Folder) => {
    if (currentFolder === null) {
      return folder.parentId === null;
    }
    return folder.parentId === currentFolder.id;
  });

  // Get current files (already filtered by API query)
  const currentFiles = files;

  const isLoading = foldersLoading || filesLoading;

  return (
    <Layout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Digital Asset Management</h1>
          <div className="flex space-x-2">
            <Button onClick={() => {
              setEditingFolder(null);
              setFolderDialogOpen(true);
            }}>
              <Folder className="mr-2 h-4 w-4" />
              New Folder
            </Button>
            <Button onClick={() => {
              setEditingFile(null);
              setFileDialogOpen(true);
            }}>
              <Upload className="mr-2 h-4 w-4" />
              Upload File
            </Button>
          </div>
        </div>

        <FolderBreadcrumb 
          currentPath={folderPath} 
          onNavigate={handleBreadcrumbNavigate} 
        />

        {isLoading ? (
          <div className="flex justify-center p-8">
            <p>Loading assets...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {currentFolders.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-3">Folders</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentFolders.map((folder: Folder) => (
                    <FolderItem 
                      key={folder.id} 
                      folder={folder} 
                      onSelect={handleFolderSelect}
                      onDelete={handleDeleteFolder}
                      onRename={handleEditFolder}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentFiles.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-3">Files</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentFiles.map((file: File) => (
                    <FileItem 
                      key={file.id} 
                      file={file}
                      onDelete={handleDeleteFile}
                      onRename={handleEditFile}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentFolders.length === 0 && currentFiles.length === 0 && (
              <div className="text-center p-8 border rounded-lg">
                <div className="mb-3">
                  {currentFolder ? (
                    <Folder className="mx-auto h-12 w-12 text-gray-400" />
                  ) : (
                    <File className="mx-auto h-12 w-12 text-gray-400" />
                  )}
                </div>
                <h3 className="text-lg font-medium">{currentFolder ? 'This folder is empty' : 'No assets yet'}</h3>
                <p className="text-gray-500 mt-1">
                  {currentFolder 
                    ? 'Upload files or create folders to organize your assets'
                    : 'Start by creating folders or uploading files to manage your digital assets'}
                </p>
                <div className="mt-4 flex justify-center space-x-3">
                  <Button variant="outline" onClick={() => {
                    setEditingFolder(null);
                    setFolderDialogOpen(true);
                  }}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Folder
                  </Button>
                  <Button variant="default" onClick={() => {
                    setEditingFile(null);
                    setFileDialogOpen(true);
                  }}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <NewFolderDialog 
        open={folderDialogOpen} 
        onOpenChange={handleFolderDialogClose} 
        currentFolder={currentFolder}
        isEditing={!!editingFolder}
        folderToEdit={editingFolder}
      />

      <FileUploadDialog 
        open={fileDialogOpen} 
        onOpenChange={handleFileDialogClose}
        currentFolder={currentFolder}
        isEditing={!!editingFile}
        fileToEdit={editingFile}
      />
    </Layout>
  );
}