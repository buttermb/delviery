import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, Download, Upload } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

export default function COAManagement() {
  const { data: products } = useQuery({
    queryKey: ["admin-products-coa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .not("coa_url", "is", null);
      
      if (error) throw error;
      return data;
    },
  });

  const getExpirationStatus = (testDate: string | null) => {
    if (!testDate) return { status: "unknown", days: 0, color: "secondary" };

    const expiresAt = new Date(testDate);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // COAs valid for 1 year
    
    const daysUntilExpiry = differenceInDays(expiresAt, new Date());

    if (daysUntilExpiry < 0) {
      return { status: "expired", days: Math.abs(daysUntilExpiry), color: "destructive" };
    } else if (daysUntilExpiry < 30) {
      return { status: "expiring-soon", days: daysUntilExpiry, color: "warning" };
    } else {
      return { status: "valid", days: daysUntilExpiry, color: "default" };
    }
  };

  const expiringSoon = products?.filter((p) => {
    const status = getExpirationStatus(p.test_date);
    return status.status === "expiring-soon" || status.status === "expired";
  });

  const validCOAs = products?.filter((p) => {
    const status = getExpirationStatus(p.test_date);
    return status.status === "valid";
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">COA Management</h1>
        <p className="text-muted-foreground">
          Track and manage Certificates of Analysis
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total COAs</p>
              <p className="text-3xl font-bold">{products?.length || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Valid COAs</p>
              <p className="text-3xl font-bold text-green-600">
                {validCOAs?.length || 0}
              </p>
            </div>
            <FileText className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
              <p className="text-3xl font-bold text-yellow-600">
                {expiringSoon?.length || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoon && expiringSoon.length > 0 && (
        <Card className="p-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                COAs Expiring Soon or Expired
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-200 mt-1">
                {expiringSoon.length} product{expiringSoon.length > 1 ? "s" : ""} need updated lab
                testing certificates
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* COA List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">All COAs</h2>
        <div className="space-y-4">
          {products?.map((product) => {
            const expiration = getExpirationStatus(product.test_date);
            
            return (
              <div
                key={product.id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div className="flex items-center gap-4 flex-1">
                  <img
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {product.lab_name && (
                        <span className="text-sm text-muted-foreground">
                          {product.lab_name}
                        </span>
                      )}
                      {product.test_date && (
                        <span className="text-sm text-muted-foreground">
                          • Tested: {new Date(product.test_date).toLocaleDateString()}
                        </span>
                      )}
                      {product.batch_number && (
                        <span className="text-sm text-muted-foreground">
                          • Batch: {product.batch_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {expiration.status === "expired" && (
                    <Badge variant="destructive">
                      Expired {expiration.days} days ago
                    </Badge>
                  )}
                  {expiration.status === "expiring-soon" && (
                    <Badge className="bg-yellow-500">
                      Expires in {expiration.days} days
                    </Badge>
                  )}
                  {expiration.status === "valid" && (
                    <Badge variant="default">
                      Valid ({expiration.days} days left)
                    </Badge>
                  )}

                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(product.coa_url, "_blank")}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = product.coa_url;
                        link.download = `COA-${product.name}.pdf`;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Help */}
      <Card className="p-6 bg-muted">
        <h3 className="font-semibold mb-2">COA Best Practices</h3>
        <ul className="text-sm space-y-1">
          <li>• COAs are typically valid for 1 year from test date</li>
          <li>• Update COAs 30 days before expiration</li>
          <li>• Ensure batch numbers match current inventory</li>
          <li>• Keep digital copies of all lab certificates</li>
          <li>• Verify lab is state-approved and accredited</li>
        </ul>
      </Card>
    </div>
  );
}
