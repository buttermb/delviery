import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Users, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const AdminCompliance = () => {
  const { session } = useAdminAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchComplianceMetrics();
    }
  }, [session]);

  const fetchComplianceMetrics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { endpoint: "compliance" }
      });

      if (error) {
        console.error("Error fetching compliance:", error);
        // Fallback - fetch basic metrics directly
        const { count: pendingVerifications } = await supabase
          .from('age_verifications')
          .select('*', { count: 'exact', head: true })
          .eq('verified', false);
        
        setMetrics({
          pendingVerifications: pendingVerifications || 0,
          verificationRate: 0,
          complianceScore: 0,
        });
        return;
      }
      setMetrics(data);
    } catch (error) {
      console.error("Failed to fetch compliance metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description,
    variant = "default"
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    description: string;
    variant?: "default" | "warning" | "success";
  }) => {
    const colors = {
      default: "text-muted-foreground",
      warning: "text-orange-500",
      success: "text-green-500",
    };

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${colors[variant]}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor age verification and regulatory compliance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Unverified Users"
          value={metrics?.unverifiedUsers || 0}
          icon={Users}
          description="Users awaiting verification"
          variant={metrics?.unverifiedUsers > 0 ? "warning" : "default"}
        />
        <MetricCard
          title="Today's Verifications"
          value={metrics?.todayVerifications || 0}
          icon={Shield}
          description="Completed today"
          variant="success"
        />
        <MetricCard
          title="Failed Verifications"
          value={metrics?.failedVerifications || 0}
          icon={AlertTriangle}
          description="Require review"
          variant={metrics?.failedVerifications > 0 ? "warning" : "default"}
        />
        <MetricCard
          title="Flagged Orders"
          value={metrics?.flaggedOrders || 0}
          icon={AlertTriangle}
          description="Compliance issues"
          variant={metrics?.flaggedOrders > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>NYC Compliance Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Age Verification (21+)</span>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Daily Flower Limit (85.05g)</span>
              <Badge variant="default">Monitored</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Daily Concentrate Limit (24g)</span>
              <Badge variant="default">Monitored</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">NYC Geofencing</span>
              <Badge variant="default">Enforced</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Common compliance tasks:
            </p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Review pending age verifications</span>
              </li>
              <li className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span>Investigate flagged orders</span>
              </li>
              <li className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Check purchase limit violations</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCompliance;
