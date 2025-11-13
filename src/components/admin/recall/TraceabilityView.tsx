import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

interface TraceabilityViewProps {
  batchId: string | null;
  onBatchSelect: (batchId: string | null) => void;
}

export function TraceabilityView({
  batchId,
  onBatchSelect,
}: TraceabilityViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Traceability</CardTitle>
        <CardDescription>
          Track products from batch to customer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="batch_search">Search by Batch Number</Label>
          <div className="flex gap-2">
            <Input
              id="batch_search"
              placeholder="e.g., BD-2024-001"
              className="min-h-[44px] touch-manipulation"
            />
            <Button className="min-h-[44px] touch-manipulation">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          <p>Traceability view coming soon.</p>
          <p className="text-sm mt-2">
            View product flow from batch to customer, including all orders and deliveries.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

