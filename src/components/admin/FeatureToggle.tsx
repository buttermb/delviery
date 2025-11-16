import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatSmartDate } from "@/lib/utils/formatDate";

interface FeatureToggleProps {
  feature: {
    feature_name: string;
    enabled: boolean;
    custom_limit?: number;
    expires_at?: string;
    reason?: string;
    granted_by?: string;
  };
  onToggle: (enabled: boolean) => Promise<void>;
  onSetCustomLimit?: (limit: number) => Promise<void>;
  onSetExpiration?: (expiresAt: string) => Promise<void>;
  readOnly?: boolean;
}

export function FeatureToggle({
  feature,
  onToggle,
  onSetCustomLimit,
  onSetExpiration,
  readOnly = false,
}: FeatureToggleProps) {
  const [loading, setLoading] = useState(false);
  const [customLimit, setCustomLimit] = useState(feature.custom_limit?.toString() || "");
  const [expirationDate, setExpirationDate] = useState(
    feature.expires_at ? new Date(feature.expires_at).toISOString().split("T")[0] : ""
  );

  const handleToggle = async (enabled: boolean) => {
    if (readOnly) return;
    
    setLoading(true);
    try {
      await onToggle(enabled);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomLimit = async () => {
    if (!onSetCustomLimit || !customLimit) return;
    
    setLoading(true);
    try {
      await onSetCustomLimit(parseInt(customLimit));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpiration = async () => {
    if (!onSetExpiration || !expirationDate) return;
    
    setLoading(true);
    try {
      await onSetExpiration(new Date(expirationDate).toISOString());
    } finally {
      setLoading(false);
    }
  };

  const isExpired = feature.expires_at && new Date(feature.expires_at) < new Date();
  const isExpiringSoon = feature.expires_at && 
    new Date(feature.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Label className="text-base font-semibold capitalize">
                {feature.feature_name.replace(/_/g, " ")}
              </Label>
              {feature.custom_limit && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Custom Limit: {feature.custom_limit.toLocaleString()}
                </Badge>
              )}
              {feature.expires_at && (
                <Badge variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}>
                  {isExpired ? "Expired" : isExpiringSoon ? "Expires Soon" : "Temporary"}
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              {feature.reason && (
                <p>Reason: {feature.reason}</p>
              )}
              {feature.expires_at && (
                <p>
                  {isExpired ? "Expired" : "Expires"}: {formatSmartDate(feature.expires_at)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={feature.enabled}
              onCheckedChange={handleToggle}
              disabled={loading || readOnly}
            />
            
            {!readOnly && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configure Feature</DialogTitle>
                    <DialogDescription>
                      Set custom limits and expiration for this feature
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {onSetCustomLimit && (
                      <div>
                        <Label>Custom Limit</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="number"
                            value={customLimit}
                            onChange={(e) => setCustomLimit(e.target.value)}
                            placeholder="Enter limit (-1 for unlimited)"
                          />
                          <Button onClick={handleSaveCustomLimit} disabled={loading}>
                            Save
                          </Button>
                        </div>
                      </div>
                    )}

                    {onSetExpiration && (
                      <div>
                        <Label>Expiration Date</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                          />
                          <Button onClick={handleSaveExpiration} disabled={loading}>
                            Save
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setExpirationDate("");
                            onSetExpiration("").catch(console.error);
                          }}
                        >
                          Remove Expiration
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

