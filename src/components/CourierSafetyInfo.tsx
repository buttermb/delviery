import { AlertTriangle, Shield, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { neighborhoods, getRiskColor, getRiskLabel, getSafetyTips } from '@/utils/neighborhoods';

interface SafetyInfoProps {
  borough?: string;
  neighborhood?: string;
  zipcode?: string;
}

export default function CourierSafetyInfo({ borough, neighborhood, zipcode }: SafetyInfoProps) {
  // Find neighborhood data from our comprehensive database
  let neighborhoodData = null;
  
  if (zipcode) {
    neighborhoodData = neighborhoods.find(n => n.zipcodes.includes(zipcode));
  } else if (neighborhood) {
    neighborhoodData = neighborhoods.find(n => 
      n.name.toLowerCase() === neighborhood.toLowerCase()
    );
  }

  // Fallback to borough-level data if specific neighborhood not found
  if (!neighborhoodData && borough) {
    const boroughNeighborhoods = neighborhoods.filter(n => 
      n.borough.toLowerCase() === borough.toLowerCase()
    );
    if (boroughNeighborhoods.length > 0) {
      const avgRisk = Math.round(
        boroughNeighborhoods.reduce((sum, n) => sum + n.risk, 0) / boroughNeighborhoods.length
      );
      neighborhoodData = {
        name: borough,
        borough: borough,
        risk: avgRisk,
        zipcodes: [],
        crimes: 0,
        avgTime: 'Varies'
      };
    }
  }

  if (!neighborhoodData) return null;

  const tips = getSafetyTips(neighborhoodData.risk);

  return (
    <Card className="border-2 border-orange-500/30 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          Delivery Safety Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 ${getRiskColor(neighborhoodData.risk)} rounded-lg flex flex-col items-center justify-center text-white`}>
            <div className="text-xl font-bold">{neighborhoodData.risk}</div>
            <div className="text-xs">/10</div>
          </div>
          <div>
            <div className="font-semibold text-sm">
              {neighborhoodData.name} Risk Level
            </div>
            <div className="text-xs text-muted-foreground mb-1">
              {neighborhoodData.borough}
            </div>
            <Badge variant="outline" className="mt-1">
              {getRiskLabel(neighborhoodData.risk)}
            </Badge>
          </div>
        </div>

        {neighborhoodData.crimes > 0 && (
          <div className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
            <span className="text-muted-foreground">Peak Danger Hours:</span>
            <span className="font-semibold">{neighborhoodData.avgTime}</span>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="w-4 h-4" />
            Safety Guidelines:
          </div>
          <ul className="text-sm space-y-1.5 text-muted-foreground">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-orange-600 dark:text-orange-400 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {neighborhoodData.risk >= 7 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="font-semibold">
                {neighborhoodData.risk >= 9 
                  ? "Consider declining deliveries after dark in this area"
                  : "Exercise extreme caution, especially during late hours"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
