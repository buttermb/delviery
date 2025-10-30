import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, TrendingUp, AlertTriangle } from "lucide-react";

export default function RiskFactorManagement() {
  const [riskFactors, setRiskFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRiskFactors();
  }, []);

  const fetchRiskFactors = async () => {
    try {
      const { data, error } = await supabase
        .from("risk_factors")
        .select("*")
        .order("risk_level", { ascending: false });

      if (error) throw error;
      setRiskFactors(data || []);
    } catch (error: any) {
      console.error("Error fetching risk factors:", error);
      toast.error("Failed to load risk factors");
    } finally {
      setLoading(false);
    }
  };

  const updateRiskFactor = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from("risk_factors")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      toast.success("Risk factor updated");
      fetchRiskFactors();
      setEditingId(null);
    } catch (error: any) {
      console.error("Error updating risk factor:", error);
      toast.error("Failed to update risk factor");
    }
  };

  const getRiskLevelColor = (level: number) => {
    if (level <= 3) return "bg-green-500";
    if (level <= 6) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getRiskLevelLabel = (level: number) => {
    if (level <= 3) return "Low Risk";
    if (level <= 6) return "Medium Risk";
    return "High Risk";
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Neighborhood Risk Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage risk levels for different NYC neighborhoods
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            NYC Neighborhoods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Neighborhood</TableHead>
                <TableHead>Borough</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Scam Reports</TableHead>
                <TableHead>Delivery Issues</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riskFactors.map((factor) => (
                <TableRow key={factor.id}>
                  <TableCell className="font-medium">{factor.neighborhood}</TableCell>
                  <TableCell>{factor.borough}</TableCell>
                  <TableCell>
                    {editingId === factor.id ? (
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        defaultValue={factor.risk_level}
                        className="w-20"
                        onBlur={(e) =>
                          updateRiskFactor(factor.id, { risk_level: parseInt(e.target.value) })
                        }
                      />
                    ) : (
                      <Badge className={getRiskLevelColor(factor.risk_level)}>
                        {factor.risk_level}/10 - {getRiskLevelLabel(factor.risk_level)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === factor.id ? (
                      <Input
                        type="number"
                        min="0"
                        defaultValue={factor.scam_reports}
                        className="w-20"
                        onBlur={(e) =>
                          updateRiskFactor(factor.id, { scam_reports: parseInt(e.target.value) })
                        }
                      />
                    ) : (
                      <span>{factor.scam_reports}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === factor.id ? (
                      <Input
                        type="number"
                        min="0"
                        defaultValue={factor.delivery_issues}
                        className="w-20"
                        onBlur={(e) =>
                          updateRiskFactor(factor.id, { delivery_issues: parseInt(e.target.value) })
                        }
                      />
                    ) : (
                      <span>{factor.delivery_issues}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(editingId === factor.id ? null : factor.id)}
                    >
                      {editingId === factor.id ? "Done" : "Edit"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Low Risk Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {riskFactors.filter((f) => f.risk_level <= 3).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Medium Risk Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">
              {riskFactors.filter((f) => f.risk_level > 3 && f.risk_level <= 6).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">High Risk Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {riskFactors.filter((f) => f.risk_level > 6).length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}