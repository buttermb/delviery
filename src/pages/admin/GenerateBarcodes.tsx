import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarcodeGenerator } from '@/components/inventory/BarcodeGenerator';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useToast } from '@/hooks/use-toast';
import { generateBulkBarcodes } from '@/utils/barcodeHelpers';
import jsPDF from 'jspdf';

export default function GenerateBarcodes() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { toast } = useToast();
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    if (!productName.trim() || quantity < 1) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter product name and quantity',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const newBarcodes = generateBulkBarcodes(quantity, 'PRD');
      
      // Save barcodes to database
      const barcodeRecords = newBarcodes.map(barcode => ({
        account_id: account?.id,
        barcode,
        barcode_type: 'CODE128',
        status: 'active'
      }));

      const { error } = await supabase.from('barcode_labels').insert(barcodeRecords);
      
      if (error) throw error;

      setBarcodes(newBarcodes);
      toast({
        title: 'Success!',
        description: `Generated ${quantity} barcodes`
      });
    } catch (error) {
      console.error('Error generating barcodes:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate barcodes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yOffset = 20;

    pdf.setFontSize(16);
    pdf.text(productName, pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 10;

    barcodes.forEach((barcode, index) => {
      if (yOffset > 250) {
        pdf.addPage();
        yOffset = 20;
      }

      pdf.setFontSize(10);
      pdf.text(barcode, pageWidth / 2, yOffset, { align: 'center' });
      yOffset += 30;

      if ((index + 1) % 10 === 0 && index !== barcodes.length - 1) {
        pdf.addPage();
        yOffset = 20;
      }
    });

    pdf.save(`${productName.replace(/\s+/g, '_')}_barcodes.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Generate Barcodes | Inventory Management"
        description="Generate and print product barcodes"
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/inventory/fronted')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">📄 Generate Barcodes</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Product Name</Label>
              <Input
                placeholder="Blue Dream 1/8oz"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            <div>
              <Label>Number of Barcodes</Label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>

            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Generate Barcodes'}
            </Button>
          </CardContent>
        </Card>

        {barcodes.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Generated Barcodes ({barcodes.length})</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePrintPDF}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={previewRef} className="grid grid-cols-3 gap-4">
                {barcodes.slice(0, 12).map((barcode) => (
                  <div key={barcode} className="border rounded-lg p-4 text-center">
                    <p className="text-sm font-medium mb-2">{productName}</p>
                    <BarcodeGenerator value={barcode} height={40} />
                  </div>
                ))}
              </div>
              {barcodes.length > 12 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  + {barcodes.length - 12} more barcodes
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
