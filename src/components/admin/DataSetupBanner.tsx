import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Database, AlertCircle } from "lucide-react";
import { useWholesaleClients } from "@/hooks/useWholesaleData";

export function DataSetupBanner() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useWholesaleClients();

  if (isLoading) return null;
  
  if (clients.length === 0) {
    return (
      <Alert className="border-yellow-500 bg-yellow-500/10">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <AlertTitle className="text-yellow-600 font-semibold">No Data Found</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">
            Your wholesale system is empty. Initialize with sample data to get started.
          </p>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={() => navigate('/admin/wholesale-setup')}
            >
              <Database className="h-4 w-4 mr-2" />
              Initialize Sample Data
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate('/admin/wholesale-clients')}
            >
              Add Manually
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
