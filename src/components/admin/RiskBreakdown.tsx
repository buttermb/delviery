import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface RiskBreakdownProps {
  factors?: {
    nameRisk: number;
    addressRisk: number;
    behaviorRisk: number;
    paymentRisk: number;
    deviceRisk: number;
  };
}

export function RiskBreakdown({ factors }: RiskBreakdownProps) {
  if (!factors) {
    return (
      <div className="text-sm text-muted-foreground">
        No risk assessment data available
      </div>
    );
  }

  const riskFactors = [
    { label: "Name Risk", value: factors.nameRisk, weight: "15%" },
    { label: "Address Risk", value: factors.addressRisk, weight: "25%" },
    { label: "Behavior Risk", value: factors.behaviorRisk, weight: "30%" },
    { label: "Payment Risk", value: factors.paymentRisk, weight: "20%" },
    { label: "Device Risk", value: factors.deviceRisk, weight: "10%" },
  ];

  const getRiskColor = (value: number) => {
    if (value < 30) return "bg-green-500";
    if (value < 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-4">
      {riskFactors.map((factor) => (
        <div key={factor.label} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{factor.label}</span>
            <span className="text-muted-foreground">
              {factor.value.toFixed(0)}/100 (Weight: {factor.weight})
            </span>
          </div>
          <div className="relative">
            <Progress value={factor.value} className="h-2" />
            <div
              className={`absolute top-0 left-0 h-2 rounded-full ${getRiskColor(factor.value)}`}
              style={{ width: `${factor.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}