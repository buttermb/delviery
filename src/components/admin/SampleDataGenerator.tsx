import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";

interface SampleDataOptions {
  products: boolean;
  customers: boolean;
  orders: boolean;
}

interface SampleDataGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_PRODUCTS = [
  {
    name: "Blue Dream",
    category: "Flower",
    strain_type: "hybrid",
    thc_percentage: 19.5,
    cbd_percentage: 0.5,
    price: 45.0,
    unit: "eighth",
    stock_quantity: 50,
  },
  {
    name: "OG Kush",
    category: "Flower",
    strain_type: "indica",
    thc_percentage: 22.0,
    cbd_percentage: 0.3,
    price: 50.0,
    unit: "eighth",
    stock_quantity: 35,
  },
  {
    name: "Sour Diesel",
    category: "Flower",
    strain_type: "sativa",
    thc_percentage: 20.5,
    cbd_percentage: 0.4,
    price: 48.0,
    unit: "eighth",
    stock_quantity: 42,
  },
];

const SAMPLE_CUSTOMERS = [
  {
    first_name: "John",
    last_name: "Smith",
    email: "john.smith@example.com",
    phone: "+1 555 0101",
  },
  {
    first_name: "Jane",
    last_name: "Doe",
    email: "jane.doe@example.com",
    phone: "+1 555 0102",
  },
  {
    first_name: "Mike",
    last_name: "Johnson",
    email: "mike.johnson@example.com",
    phone: "+1 555 0103",
  },
];

export function SampleDataGenerator({
  open,
  onOpenChange,
}: SampleDataGeneratorProps) {
  const { tenant } = useTenantAdminAuth();
  const [options, setOptions] = useState<SampleDataOptions>({
    products: true,
    customers: true,
    orders: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleOption = (key: keyof SampleDataOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    if (!tenant?.id) {
      toast.error("Tenant not found");
      return;
    }

    setIsGenerating(true);

    try {
      let productsCreated = 0;
      let customersCreated = 0;
      let ordersCreated = 0;

      // Generate Products
      if (options.products) {
        const productsWithTenant = SAMPLE_PRODUCTS.map((p) => ({
          ...p,
          tenant_id: tenant.id,
          description: `Demo ${p.name} - ${p.strain_type}`,
          is_active: true,
        }));

        const { error } = await supabase.from("products").insert(productsWithTenant);

        if (error) throw error;
        productsCreated = SAMPLE_PRODUCTS.length;
      }

      // Generate Customers
      if (options.customers) {
        const customersWithTenant = SAMPLE_CUSTOMERS.map((c) => ({
          ...c,
          tenant_id: tenant.id,
        }));

        const { error } = await supabase
          .from("customers")
          .insert(customersWithTenant);

        if (error) throw error;
        customersCreated = SAMPLE_CUSTOMERS.length;
      }

      // Generate Orders (only if both products and customers were created)
      if (options.orders && productsCreated > 0 && customersCreated > 0) {
        // Fetch the created products and customers
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price")
          .eq("tenant_id", tenant.id)
          .limit(3);

        const { data: customers } = await supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenant.id)
          .limit(3);

        if (products && customers && products.length > 0 && customers.length > 0) {
          // Create 2-3 sample orders
          const orders = [
            {
              tenant_id: tenant.id,
              customer_id: customers[0]!.id,
              status: "pending",
              subtotal: products[0]!.price,
              tax: products[0]!.price * 0.1,
              total: products[0]!.price * 1.1,
              order_date: new Date().toISOString(),
            },
          ];

          const { error: ordersError } = await supabase
            .from("orders")
            .insert(orders);

          if (ordersError) throw ordersError;
          ordersCreated = orders.length;
        }
      }

      // Show success message
      const summary = [
        productsCreated > 0 && `${productsCreated} products`,
        customersCreated > 0 && `${customersCreated} customers`,
        ordersCreated > 0 && `${ordersCreated} orders`,
      ]
        .filter(Boolean)
        .join(", ");

      toast.success(`Demo data generated successfully!`, {
        description: `Created: ${summary}`,
      });

      onOpenChange(false);
    } catch (error: unknown) {
      logger.error("Failed to generate sample data", error, {
        component: "SampleDataGenerator",
      });
      toast.error("Failed to generate demo data", {
        description: humanizeError(error),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Generate Demo Data
          </DialogTitle>
          <DialogDescription>
            Populate your account with sample data for testing and exploration.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will add demo data to your account. Use this feature for trial
            accounts only.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="products"
              checked={options.products}
              onCheckedChange={() => toggleOption("products")}
              disabled={isGenerating}
            />
            <Label
              htmlFor="products"
              className="text-sm font-normal cursor-pointer"
            >
              Add 3 sample products (Blue Dream, OG Kush, Sour Diesel)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="customers"
              checked={options.customers}
              onCheckedChange={() => toggleOption("customers")}
              disabled={isGenerating}
            />
            <Label
              htmlFor="customers"
              className="text-sm font-normal cursor-pointer"
            >
              Add 3 sample customers
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="orders"
              checked={options.orders}
              onCheckedChange={() => toggleOption("orders")}
              disabled={isGenerating || !options.products || !options.customers}
            />
            <Label
              htmlFor="orders"
              className="text-sm font-normal cursor-pointer"
            >
              Add sample orders (requires products & customers)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              (!options.products && !options.customers && !options.orders)
            }
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Demo Data"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
