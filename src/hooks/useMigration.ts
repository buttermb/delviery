// @ts-nocheck
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { 
  InputFormat, 
  ParsedProduct, 
  ValidationResult,
  MigrationStep,
  ColumnMappingItem,
} from '@/types/migration';

// Local interface for detected columns (different from the AI parsing types)
interface DetectedColumns {
  headers: string[];
  sampleData: Record<string, unknown>[];
  mappings: ColumnMappingItem[];
}

// Local interface for import result
interface ImportResult {
  success: boolean;
  totalProcessed: number;
  successfulImports: number;
  failedImports: number;
  skippedDuplicates: number;
  errors: Array<{ row: number; message: string; data: unknown }>;
}

// Local interface for import progress
interface ImportProgress {
  current: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  status: string;
}
import { detectFormat, isCSVContent, detectDelimiter } from '@/lib/migration/format-detector';
import { parseExcelFile, autoMapColumns, transformMappedDataToProducts } from '@/lib/migration/excel-parser';
import * as XLSX from 'xlsx';

export interface MigrationState {
  step: MigrationStep;
  inputFormat: InputFormat | null;
  rawInput: string | ArrayBuffer | null;
  fileName: string | null;
  detectedColumns: DetectedColumns | null;
  parsedProducts: ParsedProduct[];
  validationResults: ValidationResult[];
  importProgress: ImportProgress | null;
  importResult: ImportResult | null;
  error: string | null;
}

const initialState: MigrationState = {
  step: 'upload',
  inputFormat: null,
  rawInput: null,
  fileName: null,
  detectedColumns: null,
  parsedProducts: [],
  validationResults: [],
  importProgress: null,
  importResult: null,
  error: null,
};

export function useMigration() {
  const [state, setState] = useState<MigrationState>(initialState);

  // Reset to initial state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Go to a specific step
  const goToStep = useCallback((step: MigrationStep) => {
    setState(prev => ({ ...prev, step, error: null }));
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const format = detectFormat(file);
      
      if (format === 'excel' || format === 'csv') {
        const arrayBuffer = await file.arrayBuffer();
        const result = parseExcelFile(arrayBuffer, format);
        const columnMapping = autoMapColumns(result.headers);
        
        setState(prev => ({
          ...prev,
          inputFormat: format,
          rawInput: arrayBuffer,
          fileName: file.name,
          detectedColumns: {
            headers: result.headers,
            // Store ALL rows in sampleData (we filter for display in UI)
            sampleData: result.rows,
            mappings: columnMapping,
          },
          step: 'mapping',
        }));
      } else if (format === 'image' || format === 'pdf') {
        // For images/PDFs, we'll need OCR
        const arrayBuffer = await file.arrayBuffer();
        setState(prev => ({
          ...prev,
          inputFormat: format,
          rawInput: arrayBuffer,
          fileName: file.name,
          step: 'parsing',
        }));
      } else {
        // Text input
        const text = await file.text();
        setState(prev => ({
          ...prev,
          inputFormat: 'text',
          rawInput: text,
          fileName: file.name,
          step: 'parsing',
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process file';
      logger.error('File upload error', { error: errorMessage });
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, []);

  // Handle text paste
  const handleTextPaste = useCallback((text: string) => {
    // Check if pasted text looks like CSV - parse client-side
    if (isCSVContent(text)) {
      try {
        const delimiter = detectDelimiter(text);
        const lines = text.trim().split('\n');
        
        // Parse CSV using xlsx library
        const csv = lines.join('\n');
        const workbook = XLSX.read(csv, { type: 'string', FS: delimiter });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        
        if (rows.length === 0) {
          setState(prev => ({ ...prev, error: 'No data found in pasted text' }));
          return;
        }
        
        const headers = Object.keys(rows[0]);
        const columnMapping = autoMapColumns(headers);
        
        setState(prev => ({
          ...prev,
          inputFormat: 'csv',
          rawInput: text,
          fileName: null,
          detectedColumns: {
            headers,
            sampleData: rows,
            mappings: columnMapping,
          },
          step: 'mapping',
          error: null,
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to parse CSV text';
        logger.error('CSV paste parsing error', { error: errorMessage });
        setState(prev => ({ ...prev, error: errorMessage }));
      }
    } else {
      // For non-CSV text, go to AI parsing (requires edge function)
      setState(prev => ({
        ...prev,
        inputFormat: 'text',
        rawInput: text,
        fileName: null,
        step: 'parsing',
        error: null,
      }));
    }
  }, []);

  // Update column mappings
  const updateColumnMappings = useCallback((mappings: DetectedColumns['mappings']) => {
    setState(prev => ({
      ...prev,
      detectedColumns: prev.detectedColumns 
        ? { ...prev.detectedColumns, mappings }
        : null,
    }));
  }, []);

  // AI parsing mutation
  const parseWithAIMutation = useMutation({
    mutationFn: async (params: { content: string; format: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('menu-parse', {
        body: {
          content: params.content,
          format: params.format,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Parsing failed');
      }

      return response.data;
    },
    onSuccess: (data) => {
      const products = data.products as ParsedProduct[];
      setState(prev => ({
        ...prev,
        parsedProducts: products,
        step: 'preview',
        error: null,
      }));
    },
    onError: (error: Error) => {
      logger.error('AI parsing error', { error: error.message });
      const errorMessage = error.message.includes('Failed to send') || error.message.includes('FunctionsHttpError')
        ? 'AI parsing is not available. Please use CSV or Excel files instead, or paste your data in CSV format (comma-separated with headers).'
        : error.message;
      setState(prev => ({ ...prev, error: errorMessage }));
    },
  });

  // OCR parsing mutation
  const parseWithOCRMutation = useMutation({
    mutationFn: async (params: { imageData: string; mimeType: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('menu-ocr', {
        body: {
          imageData: params.imageData,
          mimeType: params.mimeType,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'OCR failed');
      }

      return response.data;
    },
    onSuccess: (data) => {
      const products = data.products as ParsedProduct[];
      setState(prev => ({
        ...prev,
        parsedProducts: products,
        step: 'preview',
        error: null,
      }));
    },
    onError: (error: Error) => {
      logger.error('OCR parsing error', { error: error.message });
      const errorMessage = error.message.includes('Failed to send') || error.message.includes('FunctionsHttpError')
        ? 'Image OCR is not available. Please convert your menu image to a CSV or Excel file and upload that instead.'
        : error.message;
      setState(prev => ({ ...prev, error: errorMessage }));
    },
  });

  // Client-side parsing for Excel/CSV with mapped columns
  const parseWithMappings = useCallback(() => {
    if (!state.detectedColumns) {
      setState(prev => ({ ...prev, error: 'No columns detected' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, step: 'parsing', error: null }));

      const { headers, sampleData, mappings } = state.detectedColumns;

      // Transform using the mappings (sampleData contains ALL rows)
      const products = transformMappedDataToProducts(headers, sampleData, mappings);

      if (products.length === 0) {
        setState(prev => ({ 
          ...prev, 
          step: 'mapping',
          error: 'No products could be extracted. Please check your column mappings.' 
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        parsedProducts: products,
        step: 'preview',
        error: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse data';
      logger.error('Client-side parsing error', { error: errorMessage });
      setState(prev => ({ ...prev, step: 'mapping', error: errorMessage }));
    }
  }, [state.detectedColumns]);

  // Start AI parsing (for text/image/PDF that need edge functions)
  const startAIParsing = useCallback(async () => {
    // For Excel/CSV with mappings, use client-side parsing
    if ((state.inputFormat === 'excel' || state.inputFormat === 'csv') && state.detectedColumns) {
      parseWithMappings();
      return;
    }

    if (!state.rawInput) return;

    setState(prev => ({ ...prev, step: 'parsing', error: null }));

    if (state.inputFormat === 'image') {
      // Convert to base64 for OCR
      const arrayBuffer = state.rawInput as ArrayBuffer;
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );
      const mimeType = state.fileName?.toLowerCase().endsWith('.png') 
        ? 'image/png' 
        : 'image/jpeg';
      
      parseWithOCRMutation.mutate({ imageData: base64, mimeType });
    } else {
      // Text-based parsing
      const content = typeof state.rawInput === 'string' 
        ? state.rawInput 
        : new TextDecoder().decode(state.rawInput as ArrayBuffer);
      
      const format = state.inputFormat === 'excel' ? 'excel_data' 
        : state.inputFormat === 'csv' ? 'csv_data' 
        : 'text';
      
      parseWithAIMutation.mutate({ content, format });
    }
  }, [state.rawInput, state.inputFormat, state.fileName, state.detectedColumns, parseWithMappings, parseWithAIMutation, parseWithOCRMutation]);

  // Update a single product by index
  const updateProduct = useCallback((index: number, updates: Partial<ParsedProduct>) => {
    setState(prev => ({
      ...prev,
      parsedProducts: prev.parsedProducts.map((p, i) => 
        i === index ? { ...p, ...updates } : p
      ),
    }));
  }, []);

  // Remove a product by index
  const removeProduct = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      parsedProducts: prev.parsedProducts.filter((_, i) => i !== index),
    }));
  }, []);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (products: ParsedProduct[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Get tenant ID from tenant_users table (correct table for tenant associations)
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!tenantUser?.tenant_id) {
        throw new Error('Tenant not found. Please ensure you are logged in as a tenant admin.');
      }

      const results: ImportResult = {
        success: true,
        totalProcessed: products.length,
        successfulImports: 0,
        failedImports: 0,
        skippedDuplicates: 0,
        errors: [],
      };

      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        // Update progress
        setState(prev => ({
          ...prev,
          importProgress: {
            current: i,
            total: products.length,
            currentBatch: Math.floor(i / batchSize) + 1,
            totalBatches: Math.ceil(products.length / batchSize),
            status: 'importing',
          },
        }));

        // Transform products to wholesale_inventory format
        // Note: wholesale_inventory table doesn't have is_active column
        const inventoryItems = batch.map(product => ({
          tenant_id: tenantUser.tenant_id,
          product_name: product.name,
          category: product.category || 'flower',
          strain_type: product.strainType || null,
          thc_percentage: product.thcPercentage || null,
          cbd_percentage: product.cbdPercentage || null,
          base_price: product.prices?.lb || product.prices?.oz || 0,
          prices: product.prices || {},
          quantity_lbs: product.quantityLbs || 0,
          quantity_units: product.quantityUnits || 0,
          lineage: product.lineage || null,
          grow_info: product.qualityTier || null,
          reorder_point: 0,
          warehouse_location: 'default',
        }));

        const { data, error } = await supabase
          .from('wholesale_inventory')
          .insert(inventoryItems)
          .select();

        if (error) {
          results.errors.push({
            row: i,
            message: error.message,
            data: batch[0],
          });
          results.failedImports += batch.length;
        } else {
          results.successfulImports += data.length;
        }
      }

      results.success = results.failedImports === 0;
      return results;
    },
    onSuccess: (result) => {
      setState(prev => ({
        ...prev,
        importResult: result,
        step: 'complete',
        importProgress: null,
        error: null,
      }));
    },
    onError: (error: Error) => {
      logger.error('Import error', { error: error.message });
      setState(prev => ({ 
        ...prev, 
        error: error.message,
        importProgress: null,
      }));
    },
  });

  // Start import
  const startImport = useCallback(() => {
    if (state.parsedProducts.length === 0) return;
    setState(prev => ({ ...prev, step: 'importing' }));
    importMutation.mutate(state.parsedProducts);
  }, [state.parsedProducts, importMutation]);

  return {
    state,
    reset,
    goToStep,
    handleFileUpload,
    handleTextPaste,
    updateColumnMappings,
    startAIParsing,
    updateProduct,
    removeProduct,
    startImport,
    isParsingLoading: parseWithAIMutation.isPending || parseWithOCRMutation.isPending,
    isImportLoading: importMutation.isPending,
  };
}

