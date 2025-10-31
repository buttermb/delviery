import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, ArrowUpDown } from "lucide-react";

export default function InventoryManagement() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["wholesale-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_inventory")
        .select("*")
        .order("product_name", { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const filteredInventory = inventory?.filter(item =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLbs = inventory?.reduce((sum, item) => sum + item.quantity_lbs, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📦 Inventory Management</h1>
          <p className="text-muted-foreground">Manage wholesale cannabis inventory</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Inventory
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Weight</p>
              <p className="text-2xl font-bold">{totalLbs.toFixed(1)} lbs</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl">📊</div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Products</p>
              <p className="text-2xl font-bold">{inventory?.length || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
              <p className="text-2xl font-bold">
                {inventory?.filter(item => item.quantity_lbs < item.reorder_point).length || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <Label htmlFor="search">Search Inventory</Label>
          <Input
            id="search"
            placeholder="Search by product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading inventory...</p>
          ) : filteredInventory?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No inventory found</p>
          ) : (
            filteredInventory?.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{item.product_name}</h3>
                      <Badge>{item.category}</Badge>
                      {item.quantity_lbs < item.reorder_point && (
                        <Badge variant="destructive">Low Stock</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Weight</p>
                        <p className="font-semibold">{item.quantity_lbs} lbs</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Units</p>
                        <p className="font-semibold">{item.quantity_units}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p className="font-semibold">{item.warehouse_location || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reorder Point</p>
                        <p className="font-semibold">{item.reorder_point} lbs</p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Transfer
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
