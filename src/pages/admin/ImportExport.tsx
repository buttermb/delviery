import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export default function ImportExport() {
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Setup realtime subscription for products with proper cleanup
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupChannel = async () => {
      channel = supabase
        .channel('products-changes', {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products'
          },
          (payload) => {
            console.log('Products updated:', payload);
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to products channel');
          }
        });
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, [queryClient]);

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return data;
    },
  });

  const exportToCSV = () => {
    if (!products || products.length === 0) {
      toast({ 
        title: "No products to export", 
        description: "Add some products first before exporting",
        variant: "destructive" 
      });
      return;
    }

    try {
      // Match import format exactly
      const headers = [
        "Name",
        "Category",
        "Price",
        "Stock",
        "Cannabinoid%",
        "CBD%",
        "Strain Type",
        "Description",
        "In Stock",
        "Image URL",
      ];

      const rows = products.map((p) => {
        const description = (p.description || "").replace(/"/g, '""');
        return [
          `"${p.name}"`,
          p.category || "",
          p.price || 0,
          p.stock_quantity || 0,
          p.thca_percentage || 0,
          p.cbd_content || "",
          p.strain_type || "",
          `"${description}"`,
          p.in_stock ? "Yes" : "No",
          p.image_url || "",
        ];
      });

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ 
        title: "✓ Export successful",
        description: `${products.length} products exported to CSV` 
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({ 
        title: "Export failed",
        description: "Unable to export products. Please try again.",
        variant: "destructive" 
      });
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const importFromCSV = async () => {
    try {
      setImporting(true);
      setImportSuccess(false);

      if (!csvData.trim()) {
        throw new Error("Please paste or upload CSV data first");
      }

      const lines = csvData.trim().split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      
      // Validate required headers
      if (!headers.includes("name")) {
        throw new Error("CSV must have a 'Name' column");
      }
      if (!headers.includes("category")) {
        throw new Error("CSV must have a 'Category' column");
      }

      const dataLines = lines.slice(1);
      const products: any[] = [];
      const errors: string[] = [];

      dataLines.forEach((line, index) => {
        try {
          const values = parseCSVLine(line);
          const product: any = {};

          headers.forEach((header, idx) => {
            const value = values[idx]?.replace(/^"|"$/g, "").trim();
            if (!value) return;

            switch (header) {
              case "name":
                product.name = value;
                break;
              case "category":
                const validCategories = ["flower", "pre-rolls", "edibles", "vapes", "concentrates"];
                if (validCategories.includes(value.toLowerCase())) {
                  product.category = value.toLowerCase();
                } else {
                  throw new Error(`Invalid category: ${value}. Must be one of: ${validCategories.join(", ")}`);
                }
                break;
              case "price":
                const price = parseFloat(value);
                if (isNaN(price) || price <= 0) {
                  throw new Error("Price must be a positive number");
                }
                product.price = price;
                break;
              case "stock":
              case "stock quantity":
                product.stock_quantity = Math.max(0, parseInt(value) || 0);
                break;
              case "cannabinoid%":
              case "thca%":
              case "thca":
                const thca = parseFloat(value);
                if (isNaN(thca) || thca < 0 || thca > 100) {
                  throw new Error("Cannabinoid % must be between 0 and 100");
                }
                product.thca_percentage = thca;
                break;
              case "cbd%":
              case "cbd":
                const cbd = parseFloat(value);
                if (!isNaN(cbd) && cbd >= 0) {
                  product.cbd_content = cbd;
                }
                break;
              case "strain type":
                const validStrains = ["indica", "sativa", "hybrid", "cbd"];
                if (validStrains.includes(value.toLowerCase())) {
                  product.strain_type = value.toLowerCase();
                }
                break;
              case "description":
                product.description = value;
                break;
              case "in stock":
              case "active":
                product.in_stock = value.toLowerCase() === "yes" || value.toLowerCase() === "true";
                break;
              case "image url":
              case "image":
                if (value.startsWith("http")) {
                  product.image_url = value;
                }
                break;
            }
          });

          // Validate required fields
          if (!product.name) {
            throw new Error("Name is required");
          }
          if (!product.category) {
            throw new Error("Category is required");
          }
          if (!product.price) {
            throw new Error("Price is required");
          }
          if (product.thca_percentage === undefined) {
            product.thca_percentage = 0;
          }

          products.push(product);
        } catch (error: any) {
          errors.push(`Line ${index + 2}: ${error.message}`);
        }
      });

      if (errors.length > 0) {
        throw new Error(`Import errors:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : ""}`);
      }

      if (products.length === 0) {
        throw new Error("No valid products found to import");
      }

      // Insert products in batches of 50 with progress tracking
      const batchSize = 50;
      const totalBatches = Math.ceil(products.length / batchSize);
      
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        
        // Update progress
        const progress = (currentBatch / totalBatches) * 100;
        setImportProgress(progress);
        
        const { error } = await supabase.from("products").insert(batch);
        if (error) {
          console.error("Batch insert error:", error);
          throw new Error(`Failed to import batch ${currentBatch}: ${error.message}`);
        }
        
        // Small delay between batches to prevent rate limiting
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Immediately refetch to show new products
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      
      setImportProgress(100);
      setImportSuccess(true);
      setImportedCount(products.length);
      
      toast({
        title: "✓ Import successful",
        description: `${products.length} products imported and visible on the products page`,
      });
      
      // Clear form after successful import
      setTimeout(() => {
        setCsvData("");
        setImportSuccess(false);
        setImportProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 3000);
    } catch (error: any) {
      console.error("Import error:", error);
      
      // More detailed error messages
      let errorMessage = error.message || "Failed to import products. Please check your CSV format.";
      if (error.code === "23505") {
        errorMessage = "Duplicate product detected. Some products may already exist in the database.";
      } else if (error.code === "23502") {
        errorMessage = "Missing required field. Ensure all products have Name, Category, Price, and Cannabinoid%.";
      }
      
      toast({
        title: "Import failed",
        description: errorMessage,
        variant: "destructive",
      });
      setImportSuccess(false);
      setImportProgress(0);
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file (.csv)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      toast({
        title: "File loaded",
        description: "CSV file loaded successfully. Review and click Import.",
      });
    };
    reader.onerror = () => {
      toast({
        title: "Failed to read file",
        description: "Please try again or paste the CSV data manually",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import/Export Products</h1>
        <p className="text-muted-foreground">
          Bulk manage products using CSV files
        </p>
      </div>

      {/* Export Section */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Export Products</h2>
            <p className="text-muted-foreground mb-4">
              Download all products as a CSV file
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 mb-4">
              <li>• Edit prices in Excel or Google Sheets</li>
              <li>• Backup your product data</li>
              <li>• Share with accountants or suppliers</li>
              <li>• Update stock quantities offline</li>
            </ul>
          </div>
          <Button onClick={exportToCSV} size="lg">
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>
      </Card>

      {/* Import Section */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Import Products</h2>
        <p className="text-muted-foreground mb-4">
          Upload a CSV file to bulk create products. All fields will be validated before import.
        </p>

        {importSuccess && (
          <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Successfully imported {importedCount} products! Products are now visible on the main page. Form will clear in 3 seconds...
            </AlertDescription>
          </Alert>
        )}

        {importing && (
          <Alert className="mb-4 border-blue-500 bg-blue-50 dark:bg-blue-950">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <div className="space-y-2">
                <p>Importing products... {Math.round(importProgress)}% complete</p>
                <Progress value={importProgress} className="h-2" />
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="csv-data">CSV Data</Label>
            <Textarea
              id="csv-data"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="Paste CSV data here or use the upload button below...&#10;&#10;Example:&#10;Name,Category,Price,Stock,Cannabinoid%,Description,In Stock&#10;Purple Haze,flower,45,15,24.5,Premium indoor flower,Yes"
              rows={12}
              className="mt-1.5 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {csvData.trim() ? `${csvData.trim().split("\n").length - 1} rows loaded` : "No data loaded"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV File
            </Button>
            <input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            
            <Button
              onClick={importFromCSV}
              disabled={!csvData.trim() || importing}
              size="lg"
              className="sm:ml-auto"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing {Math.round(importProgress)}%
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Import Products
                </>
              )}
            </Button>
            
            {csvData && !importing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCsvData("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <Card className="p-4 bg-muted/50">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CSV Format Example
            </h3>
            <pre className="text-xs overflow-x-auto p-3 bg-background rounded border">
{`Name,Category,Price,Stock,Cannabinoid%,CBD%,Strain Type,Description,In Stock,Image URL
Purple Haze,flower,45,15,24.5,0.5,sativa,"Premium indoor flower",Yes,https://example.com/img1.jpg
Gelato Pre-Rolls,pre-rolls,35,28,22.8,0.3,hybrid,"Hand-rolled joints",Yes,https://example.com/img2.jpg
Blue Dream Vape,vapes,55,42,28.2,0.1,sativa,"Premium distillate",Yes,https://example.com/img3.jpg`}
            </pre>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Required columns:</strong> Name, Category, Price, Cannabinoid%<br/>
              <strong>Valid categories:</strong> flower, pre-rolls, edibles, vapes, concentrates<br/>
              <strong>Valid strain types:</strong> indica, sativa, hybrid, cbd
            </AlertDescription>
          </Alert>
        </div>
      </Card>

      {/* Tips */}
      <Card className="p-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Import Tips & Guidelines
        </h3>
        <div className="grid gap-3 text-sm">
          <div>
            <strong className="text-blue-900 dark:text-blue-100">Required Fields:</strong>
            <ul className="mt-1 space-y-1 text-blue-800 dark:text-blue-200">
              <li>• <strong>Name:</strong> Product name (3-200 characters)</li>
              <li>• <strong>Category:</strong> Must be one of: flower, pre-rolls, edibles, vapes, concentrates</li>
              <li>• <strong>Price:</strong> Must be a positive number (e.g., 45.99)</li>
              <li>• <strong>Cannabinoid%:</strong> Number between 0-100</li>
            </ul>
          </div>
          <div>
            <strong className="text-blue-900 dark:text-blue-100">Formatting Rules:</strong>
            <ul className="mt-1 space-y-1 text-blue-800 dark:text-blue-200">
              <li>• First row must contain column headers</li>
              <li>• Wrap text with commas in double quotes: "Description, with commas"</li>
              <li>• Use "Yes"/"No" or "true"/"false" for In Stock column</li>
              <li>• Image URLs must start with http:// or https://</li>
              <li>• Maximum file size: 5MB</li>
            </ul>
          </div>
          <div>
            <strong className="text-blue-900 dark:text-blue-100">Validation:</strong>
            <ul className="mt-1 space-y-1 text-blue-800 dark:text-blue-200">
              <li>• All products are validated before import</li>
              <li>• Invalid rows will be skipped with error messages</li>
              <li>• Import processes in batches of 100 products</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
