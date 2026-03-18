import { UsageLimitGuard } from "@/components/tenant-admin/UsageLimitGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

/**
 * Example page showing how to use UsageLimitGuard
 * This component wraps any feature that has usage limits
 */
export default function CustomersExamplePage() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-3xl font-bold mb-2">Customers</h1>
        <p className="text-muted-foreground">Manage your customer base</p>
      </div>

      {/* Wrap the "Add Customer" action with UsageLimitGuard */}
      <UsageLimitGuard resource="customers">
        <Card>
          <CardHeader>
            <CardTitle>Add New Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </CardContent>
        </Card>
      </UsageLimitGuard>

      {/* Customer list would go here */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Your customers will appear here...</p>
        </CardContent>
      </Card>
    </div>
  );
}
