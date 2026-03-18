import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Image,
  ClipboardPaste,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadStepProps {
  onFileUpload: (file: File) => Promise<void>;
  onTextPaste: (text: string) => void;
}

export function UploadStep({ onFileUpload, onTextPaste }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      await onFileUpload(selectedFile);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasteSubmit = () => {
    if (pastedText.trim()) {
      onTextPaste(pastedText);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
    }
    if (['jpg', 'jpeg', 'png', 'pdf'].includes(ext ?? '')) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    return <FileText className="h-8 w-8 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-lg font-semibold mb-2">Import Your Menu Data</h3>
        <p className="text-sm text-muted-foreground">
          Upload a file or paste your menu text. We support Excel, CSV, images, and plain text.
        </p>
      </div>

      <Tabs defaultValue="file" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="paste" className="gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Paste Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-6">
          <div
            className={cn(
              'relative border-2 border-dashed rounded-lg p-12 transition-all',
              'cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5',
              isDragging && 'border-emerald-500 bg-emerald-500/10',
              selectedFile && 'border-emerald-500/50 bg-emerald-500/5'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.pdf"
              onChange={handleFileSelect}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-4">
                {getFileIcon(selectedFile.name)}
                <div className="text-center">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="absolute top-4 right-4"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="p-4 rounded-full bg-emerald-500/10">
                  <Upload className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium">
                    Drop your file here, or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports XLSX, CSV, TXT, JPG, PNG, PDF
                  </p>
                </div>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Upload className="h-4 w-4 animate-pulse" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Process File
                  </>
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="paste" className="mt-6">
          <div className="space-y-4">
            <Textarea
              aria-label="Paste menu data"
              placeholder={`Paste your menu data here...

Example formats we support:

Product Name | Category | Price | THC%
Blue Dream | Flower | $2,200 | 24%
OG Kush | Flower | $2,400 | 28%

Or just raw text like:
Blue Dream - Indoor Exotic - 2.2k/lb - 24% THC
Gelato 41 - Greenhouse - 1.8k - 22% THC`}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            
            <div className="flex justify-end">
              <Button
                onClick={handlePasteSubmit}
                disabled={!pastedText.trim()}
                className="gap-2"
              >
                <ClipboardPaste className="h-4 w-4" />
                Process Text
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Supported formats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          Excel (.xlsx)
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 text-blue-500" />
          CSV (.csv)
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image className="h-4 w-4 text-purple-500" />
          Images (JPG, PNG)
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 text-red-500" />
          PDF Documents
        </div>
      </div>
    </div>
  );
}




