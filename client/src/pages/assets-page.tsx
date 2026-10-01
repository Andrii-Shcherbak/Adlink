import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { 
  Folder, File as FileIcon, Upload, Plus, X, PenSquare, Trash, ChevronRight, ChevronDown,
  Image as ImageIcon, Video as VideoIcon, AudioLines as AudioLinesIcon, 
  FileText as FileTextIcon, Table as TableIcon, FileType as FileTypeIcon, 
  ExternalLink as ExternalLinkIcon
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { AssetDropUploadProvider, FileDropArea, useFileDropTarget } from '@/components/asset-drop-upload';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Define folder creation form schema
const folderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100, "Folder name is too long"),
  parentId: z.number().nullable().optional(),
  path: z.string().optional(), // Added for server-side requirement
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

// DnD item types
const ItemTypes = {
  FOLDER: 'folder',
  FILE: 'file'
};

// Format file size helper
const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

// Get file icon by type helper
const getIconByType = (type: string) => {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type === 'application/pdf') return '📄';
  return '📁';
};

// Component to display a folder
const FolderItem: React.FC<{ 
  folder: Folder; 
  onSelect: (folder: Folder) => void;
  onDelete: (id: number) => void;
  onRename: (folder: Folder) => void;
  onMoveItem?: (dragItem: { type: string, id: number }, targetFolderId: number | null) => void;
  depth?: number;
  childFolders?: Folder[];
  childFiles?: File[];
  expanded?: boolean;
  onToggleExpand?: (folderId: number) => void;
  isTreeView?: boolean;
}> = ({ 
  folder, 
  onSelect, 
  onDelete, 
  onRename, 
  onMoveItem, 
  depth = 0, 
  childFolders = [], 
  childFiles = [],
  expanded = false,
  onToggleExpand,
  isTreeView = false
}) => {
  const { isFileOver, dropProps: fileDropProps } = useFileDropTarget(folder.id, folder.name);

  // Setup drag functionality
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.FOLDER,
    item: { type: ItemTypes.FOLDER, id: folder.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  // Setup drop functionality (only for grid view)
  // In tree view, we'll handle this separately
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.FOLDER, ItemTypes.FILE],
    drop: (item: { type: string, id: number }) => {
      if (onMoveItem && !isTreeView) onMoveItem(item, folder.id);
      return { folderId: folder.id };
    },
    canDrop: (item) => item.id !== folder.id, // Can't drop a folder onto itself
    collect: (monitor) => ({
      isOver: monitor.isOver() && !isTreeView,
      canDrop: monitor.canDrop() && !isTreeView,
    }),
  }));

  // Combine drag and drop refs for grid view only
  const ref = useRef<HTMLDivElement>(null);
  if (!isTreeView) {
    drag(drop(ref));
  } else {
    drag(ref);
  }

  // For tree view (Replit-style)
  if (isTreeView) {
    const hasChildren = childFolders.length > 0 || childFiles.length > 0;
    const paddingLeft = depth * 16; // Reduced padding for more compact view
    
    // Setup drop functionality for folders
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
      accept: [ItemTypes.FOLDER, ItemTypes.FILE],
      drop: (item: { type: string, id: number }) => {
        if (onMoveItem) {
          onMoveItem(item, folder.id);
        }
        return { folderId: folder.id };
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }));
    
    // Combine refs
    const combinedRef = (element: HTMLDivElement) => {
      if (ref) {
        // @ts-ignore - ref.current assignment
        ref.current = element;
      }
      drop(element);
    };

    return (
      <div>
        <div
          ref={combinedRef}
          {...fileDropProps}
          className={`group flex items-center px-1 py-0.5 text-sm rounded transition-colors ${
            (isOver && canDrop) || isFileOver
              ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400'  
              : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/50'
          } ${isDragging ? 'opacity-50' : 'opacity-100'}`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand && onToggleExpand(folder.id);
              }}
              className="w-4 h-4 flex items-center justify-center focus:outline-none"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-gray-400" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-400" />
              )}
            </button>
          ) : (
            <div className="w-4 h-4" />
          )}
          <div 
            className="flex-1 flex items-center cursor-pointer pl-1 min-w-0"
            onClick={() => onSelect(folder)}
          >
            <Folder className="h-3.5 w-3.5 text-blue-500 mr-1.5 shrink-0" />
            <span className="truncate font-medium">{folder.name}</span>
          </div>
          <div className="flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onRename(folder);
              }}
            >
              <PenSquare className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder.id);
              }}
            >
              <Trash className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div>
            {childFolders.map(childFolder => (
              <FolderItem 
                key={childFolder.id}
                folder={childFolder}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                onMoveItem={onMoveItem}
                depth={depth + 1}
                isTreeView
              />
            ))}
            
            {childFiles.map(file => (
              <FileItem 
                key={file.id}
                file={file}
                onDelete={onDelete}
                onRename={onRename}
                onMove={onMoveItem}
                depth={depth + 1}
                isTreeView
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // For grid view (modern and compact)
  return (
    <div
      ref={ref}
      {...fileDropProps}
      className={`group flex items-center rounded-md cursor-pointer p-2.5 transition-colors ${
        (isOver && canDrop) || isFileOver
          ? 'bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-400'
          : 'hover:bg-gray-50/50 dark:hover:bg-gray-900/10'
      } ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      <div className="flex-1 flex items-center space-x-2 overflow-hidden" onClick={() => onSelect(folder)}>
        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md shrink-0">
          <Folder className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="overflow-hidden">
          <h3 className="font-medium text-sm truncate">{folder.name}</h3>
        </div>
      </div>
      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
          e.stopPropagation();
          onRename(folder);
        }}>
          <PenSquare className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
          e.stopPropagation();
          onDelete(folder.id);
        }}>
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

// Component to display a file
const FileItem: React.FC<{ 
  file: File; 
  onDelete: (id: number) => void;
  onRename: (file: File) => void;
  onMove?: (dragItem: { type: string, id: number }, targetFolderId: number | null) => void;
  depth?: number;
  isTreeView?: boolean;
}> = ({ file, onDelete, onRename, onMove, depth = 0, isTreeView = false }) => {
  // Setup drag functionality
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.FILE,
    item: { type: ItemTypes.FILE, id: file.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  // For tree view (Replit-style)
  if (isTreeView) {
    const paddingLeft = depth * 16; // Reduced padding for more compact view
    const fileIcon = () => {
      const contentType = file.contentType;
      if (contentType.startsWith('image/')) return <ImageIcon className="h-3.5 w-3.5 text-green-500" />;
      if (contentType.startsWith('video/')) return <VideoIcon className="h-3.5 w-3.5 text-red-500" />;
      if (contentType.startsWith('audio/')) return <AudioLinesIcon className="h-3.5 w-3.5 text-orange-500" />;
      if (contentType === 'application/pdf') return <FileTextIcon className="h-3.5 w-3.5 text-purple-500" />;
      if (contentType.includes('spreadsheet') || contentType.includes('excel')) return <TableIcon className="h-3.5 w-3.5 text-emerald-500" />;
      if (contentType.includes('document') || contentType.includes('word')) return <FileTypeIcon className="h-3.5 w-3.5 text-blue-500" />;
      return <FileIcon className="h-3.5 w-3.5 text-gray-400" />;
    };

    return (
      <div 
        ref={drag}
        className={`group flex items-center px-1 py-0.5 text-sm hover:bg-gray-50/80 dark:hover:bg-gray-800/50 rounded transition-colors ${
          isDragging ? 'opacity-50' : 'opacity-100'
        }`}
        style={{ paddingLeft: `${paddingLeft + 4}px` }}
      >
        <div className="w-4" /> {/* Spacer to align with folders that have expand icons */}
        <div className="flex-1 flex items-center cursor-pointer min-w-0">
          <div className="mr-1.5">
            {fileIcon()}
          </div>
          <span className="truncate">{file.name}</span>
          <span className="ml-1.5 text-[10px] text-gray-400">{formatFileSize(file.fileSize)}</span>
        </div>
        <div className="flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              window.open(file.secureUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <ExternalLinkIcon className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onRename(file);
            }}
          >
            <PenSquare className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.id);
            }}
          >
            <Trash className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // For grid view (modern and compact)
  const fileIcon = () => {
    const contentType = file.contentType;
    if (contentType.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-green-500" />;
    if (contentType.startsWith('video/')) return <VideoIcon className="h-4 w-4 text-red-500" />;
    if (contentType.startsWith('audio/')) return <AudioLinesIcon className="h-4 w-4 text-orange-500" />;
    if (contentType === 'application/pdf') return <FileTextIcon className="h-4 w-4 text-purple-500" />;
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return <TableIcon className="h-4 w-4 text-emerald-500" />;
    if (contentType.includes('document') || contentType.includes('word')) return <FileTypeIcon className="h-4 w-4 text-blue-500" />;
    return <FileIcon className="h-4 w-4 text-gray-400" />;
  };

  const getColorByType = () => {
    const contentType = file.contentType;
    if (contentType.startsWith('image/')) return 'bg-green-100 dark:bg-green-900/30';
    if (contentType.startsWith('video/')) return 'bg-red-100 dark:bg-red-900/30';
    if (contentType.startsWith('audio/')) return 'bg-orange-100 dark:bg-orange-900/30';
    if (contentType === 'application/pdf') return 'bg-purple-100 dark:bg-purple-900/30';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (contentType.includes('document') || contentType.includes('word')) return 'bg-blue-100 dark:bg-blue-900/30';
    return 'bg-gray-100 dark:bg-gray-800';
  };

  const fileExtension = file.name.split('.').pop()?.toUpperCase() || '';
  
  return (
    <div 
      ref={drag}
      className={`group flex items-center rounded-md p-2.5 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-900/10 ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <div className="flex-1 flex items-center space-x-2 overflow-hidden min-w-0">
        <div className={`p-1.5 rounded-md shrink-0 ${getColorByType()}`}>
          {fileIcon()}
        </div>
        <div className="overflow-hidden min-w-0">
          <h3 className="font-medium text-sm truncate">{file.name}</h3>
          <div className="flex items-center text-xs text-gray-400 space-x-2">
            <span>{formatFileSize(file.fileSize)}</span>
            {fileExtension && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="uppercase">{fileExtension}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            window.open(file.secureUrl, '_blank', 'noopener,noreferrer');
          }}
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={(e) => {
            e.stopPropagation();
            onRename(file);
          }}
        >
          <PenSquare className="h-3.5 w-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(file.id);
          }}
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
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

  // The dialog stays mounted, so refresh its values for the current folder each time it opens
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: isEditing ? folderToEdit?.name || '' : '',
      parentId: isEditing ? folderToEdit?.parentId ?? null : currentFolder?.id ?? null,
    });
  }, [open, isEditing, folderToEdit, currentFolder?.id]);

  const createFolderMutation = useMutation({
    mutationFn: async (data: FolderFormValues & { path?: string }) => {
      // Add required path field with default value, server will calculate the correct path
      const folderData = {
        ...data,
        path: '/', // Default path, will be overridden by server logic
      };
      
      return apiRequest('/api/assets/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folderData),
      });
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

  // The dialog stays mounted, so refresh its values for the current folder each time it opens
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: isEditing ? fileToEdit?.name || '' : '',
      folderId: isEditing ? fileToEdit?.folderId ?? null : currentFolder?.id ?? null,
      description: isEditing ? fileToEdit?.description || '' : '',
    });
    setFile(null);
  }, [open, isEditing, fileToEdit, currentFolder?.id]);

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
    <div className="flex items-center text-xs overflow-x-auto whitespace-nowrap scrollbar-thin">
      {currentPath.map((folder, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="mx-0.5 h-3 w-3 text-gray-400 shrink-0" />}
          <button
            type="button"
            className="hover:text-blue-500 transition-colors py-0.5 px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center"
            onClick={() => onNavigate(folder.id)}
          >
            {index === 0 && <Folder className="mr-1 h-3 w-3 text-blue-500" />}
            <span className="max-w-[120px] truncate">{folder.name}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// Tree Node component to render file system in tree view
const TreeNode: React.FC<{
  folders: Folder[],
  files: File[], 
  onFolderSelect: (folder: Folder) => void,
  onDeleteFolder: (id: number) => void,
  onRenameFolder: (folder: Folder) => void,
  onDeleteFile: (id: number) => void,
  onRenameFile: (file: File) => void,
  onMoveItem?: (dragItem: { type: string, id: number }, targetFolderId: number | null) => void,
  expandedFolders: Set<number>
  onToggleFolder: (folderId: number) => void
}> = ({ 
  folders, 
  files, 
  onFolderSelect, 
  onDeleteFolder, 
  onRenameFolder,
  onDeleteFile,
  onRenameFile,
  onMoveItem,
  expandedFolders,
  onToggleFolder
}) => {
  // Build folder hierarchy
  const folderMap = new Map<number | null, Folder[]>();
  const fileMap = new Map<number | null, File[]>();
  
  // Group folders by parent
  folders.forEach(folder => {
    const parentId = folder.parentId;
    if (!folderMap.has(parentId)) {
      folderMap.set(parentId, []);
    }
    folderMap.get(parentId)!.push(folder);
  });
  
  // Group files by folder
  files.forEach(file => {
    const folderId = file.folderId;
    if (!fileMap.has(folderId)) {
      fileMap.set(folderId, []);
    }
    fileMap.get(folderId)!.push(file);
  });
  
  // Render root level folders and files
  const renderLevel = (parentId: number | null) => {
    const childFolders = folderMap.get(parentId) || [];
    const childFiles = fileMap.get(parentId) || [];
    
    return (
      <div className="space-y-1">
        {childFolders.map(folder => (
          <FolderItem
            key={folder.id}
            folder={folder}
            onSelect={onFolderSelect}
            onDelete={onDeleteFolder}
            onRename={onRenameFolder}
            onMoveItem={onMoveItem}
            childFolders={folderMap.get(folder.id) || []}
            childFiles={fileMap.get(folder.id) || []}
            expanded={expandedFolders.has(folder.id)}
            onToggleExpand={onToggleFolder}
            isTreeView={true}
          />
        ))}
        
        {childFiles.map(file => (
          <FileItem
            key={file.id}
            file={file}
            onDelete={onDeleteFile}
            onRename={onRenameFile}
            onMove={onMoveItem}
            isTreeView={true}
          />
        ))}
      </div>
    );
  };
  
  return renderLevel(null);
};

// Root drop area for files and folders
const RootDropArea: React.FC<{
  onMoveItem: (dragItem: { type: string, id: number }, targetFolderId: number | null) => void
}> = ({ onMoveItem }) => {
  const { isFileOver, dropProps: fileDropProps } = useFileDropTarget(null, 'Root');
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.FOLDER, ItemTypes.FILE],
    drop: (item: { type: string, id: number }) => {
      onMoveItem(item, null);
      return { folderId: null };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));
  
  return (
    <div
      ref={drop}
      {...fileDropProps}
      className={`rounded-md border-2 border-dashed mb-2 ${
        (isOver && canDrop) || isFileOver 
          ? 'border-blue-400 bg-blue-50/40 dark:border-blue-600 dark:bg-blue-900/10' 
          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-900/10'
      } transition-colors`}
    >
      <div className="text-center py-1.5 text-xs text-gray-400 flex items-center justify-center gap-1.5">
        <Folder className="h-3 w-3 text-gray-400" />
        <span>Root folder drop zone</span>
      </div>
    </div>
  );
};

// Main Assets Management page component
export default function AssetsPage() {
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('tree'); // Default to tree view
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
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

  // Breadcrumb follows the folder's actual ancestors, so it stays right after
  // selecting sibling folders or moving/renaming folders
  const folderPath = useMemo(() => {
    const trail: { id: number | null, name: string }[] = [];
    const seen = new Set<number>();
    let folder = currentFolder
      ? (folders as Folder[]).find(f => f.id === currentFolder.id) ?? currentFolder
      : null;
    while (folder && !seen.has(folder.id)) {
      seen.add(folder.id);
      trail.unshift({ id: folder.id, name: folder.name });
      const parentId: number | null = folder.parentId;
      folder = parentId ? (folders as Folder[]).find(f => f.id === parentId) ?? null : null;
    }
    return [{ id: null, name: 'Root' }, ...trail];
  }, [currentFolder, folders]);

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
    // File links are signed for 1 hour; refresh them well before they expire
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
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
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = (id: number | null) => {
    if (id === null) {
      // Navigate to root
      setCurrentFolder(null);
    } else {
      const folder = folders.find((f: Folder) => f.id === id);
      if (folder) {
        setCurrentFolder(folder);
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

  // Toggle folder expansion
  const handleToggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // Handle moving items (drag & drop)
  const moveItemMutation = useMutation({
    mutationFn: async ({ item, targetFolderId }: { item: { type: string, id: number }, targetFolderId: number | null }) => {
      // Different endpoints for files and folders
      const endpoint = item.type === ItemTypes.FOLDER
        ? `/api/assets/folders/${item.id}`
        : `/api/assets/files/${item.id}`;
      
      return apiRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(
          item.type === ItemTypes.FOLDER
            ? { parentId: targetFolderId }
            : { folderId: targetFolderId }
        ),
      });
    },
    onSuccess: () => {
      // Refresh both folders and files
      queryClient.invalidateQueries({ queryKey: ['/api/assets/folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/assets/files'] });
      toast({
        title: "Success",
        description: "Item moved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to move item: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Get all files for tree view (not just current folder)
  const { 
    data: allFiles = [], 
    isLoading: allFilesLoading 
  } = useQuery({
    queryKey: ['/api/assets/files', 'all'],
    queryFn: async () => {
      const response = await apiRequest('/api/assets/files');
      return Array.isArray(response) ? response : [];
    },
    // Only fetch all files when in tree view
    enabled: viewMode === 'tree',
  });

  return (
    <Layout>
      <DndProvider backend={HTML5Backend}>
        <AssetDropUploadProvider folders={folders}>
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
            <h1 className="text-2xl font-bold">Digital Asset Management</h1>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex border rounded-md overflow-hidden shadow-sm">
                <Button 
                  variant={viewMode === 'tree' ? 'default' : 'ghost'} 
                  size="sm"
                  className="rounded-none h-8"
                  onClick={() => setViewMode('tree')}
                >
                  <ChevronRight className="mr-1.5 h-3.5 w-3.5" />
                  Tree View
                </Button>
                <Button 
                  variant={viewMode === 'grid' ? 'default' : 'ghost'} 
                  size="sm"
                  className="rounded-none h-8"
                  onClick={() => setViewMode('grid')}
                >
                  <div className="grid grid-cols-2 gap-0.5 mr-1.5 h-3.5 w-3.5">
                    <div className="bg-current rounded-sm" />
                    <div className="bg-current rounded-sm" />
                    <div className="bg-current rounded-sm" />
                    <div className="bg-current rounded-sm" />
                  </div>
                  Grid View
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button size="sm" onClick={() => {
                  setEditingFolder(null);
                  setFolderDialogOpen(true);
                }}>
                  <Folder className="mr-1.5 h-3.5 w-3.5" />
                  New Folder
                </Button>
                <Button size="sm" onClick={() => {
                  setEditingFile(null);
                  setFileDialogOpen(true);
                }}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload File
                </Button>
              </div>
            </div>
          </div>

          {viewMode === 'grid' && (
            <div className="mb-3">
              <FolderBreadcrumb 
                currentPath={folderPath} 
                onNavigate={handleBreadcrumbNavigate} 
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-8">
              <p>Loading assets...</p>
            </div>
          ) : (
            <>
              {viewMode === 'tree' ? (
                <div className="mt-3 flex flex-col md:flex-row gap-4 h-[calc(100vh-220px)]">
                  <div className="w-full md:w-72 border-r border-gray-200 dark:border-gray-800 h-full overflow-auto">
                    <div className="sticky top-0 px-3 py-2 mb-2 flex items-center justify-between bg-background z-10">
                      <h2 className="text-sm font-semibold flex items-center text-blue-600 dark:text-blue-400">
                        <Folder className="mr-1.5 h-3.5 w-3.5" />
                        File Explorer
                      </h2>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        setEditingFolder(null);
                        setFolderDialogOpen(true);
                      }}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mb-2 px-3">
                      <RootDropArea 
                        onMoveItem={(item, targetId) => 
                          moveItemMutation.mutate({ item, targetFolderId: targetId })
                        } 
                      />
                    </div>
                    <div className="pr-1 scrollbar-thin">
                      <TreeNode 
                        folders={folders}
                        files={allFiles}
                        onFolderSelect={handleFolderSelect}
                        onDeleteFolder={handleDeleteFolder}
                        onRenameFolder={handleEditFolder}
                        onDeleteFile={handleDeleteFile}
                        onRenameFile={handleEditFile}
                        onMoveItem={(item, targetId) => 
                          moveItemMutation.mutate({ item, targetFolderId: targetId })
                        }
                        expandedFolders={expandedFolders}
                        onToggleFolder={handleToggleFolder}
                      />
                    </div>
                  </div>
                  
                  <FileDropArea
                    folderId={currentFolder?.id ?? null}
                    label={currentFolder?.name ?? 'Root'}
                    className="flex-1 h-full overflow-hidden flex flex-col"
                  >
                    <div className="h-full flex flex-col">
                      <div className="flex justify-between items-center mb-3 px-1">
                        <h2 className="text-sm font-semibold text-violet-600 dark:text-violet-400 flex items-center">
                          <FileIcon className="mr-1.5 h-3.5 w-3.5" />
                          {currentFolder ? currentFolder.name : 'All Files'}
                        </h2>
                        
                        <div className="flex items-center gap-2">
                          {currentFolder && (
                            <div className="text-xs text-gray-400">
                              <FolderBreadcrumb 
                                currentPath={folderPath} 
                                onNavigate={handleBreadcrumbNavigate} 
                              />
                            </div>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingFile(null);
                            setFileDialogOpen(true);
                          }}>
                            <Upload className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-auto">
                        {currentFiles.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 px-1">
                            {currentFiles.map((file: File) => (
                              <FileItem 
                                key={file.id} 
                                file={file}
                                onDelete={handleDeleteFile}
                                onRename={handleEditFile}
                                onMove={(item, targetId) => 
                                  moveItemMutation.mutate({ item, targetFolderId: targetId })
                                }
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center p-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg mx-2 h-full flex flex-col items-center justify-center">
                            <div className="mb-3">
                              <FileIcon className="mx-auto h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-sm font-medium">No files in this {currentFolder ? 'folder' : 'location'}</h3>
                            <p className="text-xs text-gray-400 mt-1 mb-3">
                              Upload files, or drag files and folders here from your computer
                            </p>
                            <Button variant="outline" size="sm" onClick={() => setFileDialogOpen(true)}>
                              <Upload className="mr-1.5 h-3 w-3" />
                              Upload File
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </FileDropArea>
                </div>
              ) : (
                <FileDropArea
                  folderId={currentFolder?.id ?? null}
                  label={currentFolder?.name ?? 'Root'}
                  className="h-[calc(100vh-220px)] p-1 flex flex-col"
                >
                  <div className="flex-1 overflow-y-auto">
                    {currentFolders.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center mb-2">
                          <h2 className="text-base font-semibold text-blue-600 dark:text-blue-400 flex items-center">
                            <Folder className="mr-2 h-4 w-4" />
                            Folders
                          </h2>
                          <div className="ml-auto">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditingFolder(null);
                              setFolderDialogOpen(true);
                            }}>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              New
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                          {currentFolders.map((folder: Folder) => (
                            <FolderItem 
                              key={folder.id} 
                              folder={folder} 
                              onSelect={handleFolderSelect}
                              onDelete={handleDeleteFolder}
                              onRename={handleEditFolder}
                              onMoveItem={(item, targetId) => 
                                moveItemMutation.mutate({ item, targetFolderId: targetId })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {currentFiles.length > 0 && (
                      <div>
                        <div className="flex items-center mb-2">
                          <h2 className="text-base font-semibold text-violet-600 dark:text-violet-400 flex items-center">
                            <FileIcon className="mr-2 h-4 w-4" />
                            Files
                          </h2>
                          <div className="ml-auto">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditingFile(null);
                              setFileDialogOpen(true);
                            }}>
                              <Upload className="h-3.5 w-3.5 mr-1" />
                              Upload
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                          {currentFiles.map((file: File) => (
                            <FileItem 
                              key={file.id} 
                              file={file}
                              onDelete={handleDeleteFile}
                              onRename={handleEditFile}
                              onMove={(item, targetId) => 
                                moveItemMutation.mutate({ item, targetFolderId: targetId })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {currentFolders.length === 0 && currentFiles.length === 0 && (
                      <div className="text-center p-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50/30 dark:bg-gray-900/30 h-full flex flex-col items-center justify-center">
                        <div className="mb-3">
                          {currentFolder ? (
                            <Folder className="mx-auto h-10 w-10 text-gray-400" />
                          ) : (
                            <FileIcon className="mx-auto h-10 w-10 text-gray-400" />
                          )}
                        </div>
                        <h3 className="text-base font-medium">{currentFolder ? 'This folder is empty' : 'No assets yet'}</h3>
                        <p className="text-sm text-gray-400 mt-1 mb-4">
                          {currentFolder
                            ? 'Upload files or create folders to organize your assets'
                            : 'Start by creating folders or uploading files to manage your digital assets'}
                          <br />
                          You can also drag files and folders here from your computer.
                        </p>
                        <div className="flex justify-center space-x-3">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingFolder(null);
                            setFolderDialogOpen(true);
                          }}>
                            <Folder className="mr-2 h-3.5 w-3.5" />
                            New Folder
                          </Button>
                          <Button size="sm" variant="default" onClick={() => {
                            setEditingFile(null);
                            setFileDialogOpen(true);
                          }}>
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            Upload File
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </FileDropArea>
              )}
            </>
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
        </AssetDropUploadProvider>
      </DndProvider>
    </Layout>
  );
}