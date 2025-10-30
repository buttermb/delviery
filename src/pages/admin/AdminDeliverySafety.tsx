import React, { useState } from 'react';
import { AlertTriangle, MapPin, Shield, Clock, Package, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// NYC Neighborhoods with safety risk scores (1-10, where 10 = highest risk)
const neighborhoods = {
  manhattan: [
    { name: "Upper East Side", risk: 2, zone: "UES", crimes: 12, avgTime: "8pm-2am", lat: 40.7736, lng: -73.9566 },
    { name: "Upper West Side", risk: 2, zone: "UWS", crimes: 15, avgTime: "9pm-3am", lat: 40.7870, lng: -73.9754 },
    { name: "Midtown", risk: 4, zone: "MTW", crimes: 45, avgTime: "All hours", lat: 40.7580, lng: -73.9855 },
    { name: "Chelsea", risk: 3, zone: "CHL", crimes: 28, avgTime: "10pm-4am", lat: 40.7465, lng: -73.9975 },
    { name: "Greenwich Village", risk: 3, zone: "GRV", crimes: 22, avgTime: "9pm-2am", lat: 40.7336, lng: -74.0027 },
    { name: "East Village", risk: 4, zone: "EVL", crimes: 38, avgTime: "10pm-4am", lat: 40.7264, lng: -73.9815 },
    { name: "Lower East Side", risk: 5, zone: "LES", crimes: 52, avgTime: "10pm-5am", lat: 40.7154, lng: -73.9874 },
    { name: "Harlem", risk: 7, zone: "HRL", crimes: 78, avgTime: "9pm-5am", lat: 40.8116, lng: -73.9465 },
    { name: "Washington Heights", risk: 6, zone: "WHT", crimes: 65, avgTime: "8pm-4am", lat: 40.8518, lng: -73.9365 },
    { name: "Inwood", risk: 6, zone: "INW", crimes: 58, avgTime: "9pm-3am", lat: 40.8677, lng: -73.9212 },
    { name: "Battery Park", risk: 2, zone: "BPC", crimes: 18, avgTime: "10pm-2am", lat: 40.7033, lng: -74.0170 },
    { name: "Tribeca", risk: 2, zone: "TBC", crimes: 14, avgTime: "9pm-1am", lat: 40.7163, lng: -74.0086 }
  ],
  brooklyn: [
    { name: "Williamsburg", risk: 3, zone: "WBG", crimes: 32, avgTime: "10pm-4am", lat: 40.7081, lng: -73.9571 },
    { name: "Bushwick", risk: 6, zone: "BSH", crimes: 68, avgTime: "9pm-5am", lat: 40.6942, lng: -73.9222 },
    { name: "Bedford-Stuyvesant", risk: 7, zone: "BDS", crimes: 82, avgTime: "8pm-5am", lat: 40.6868, lng: -73.9426 },
    { name: "Crown Heights", risk: 6, zone: "CRH", crimes: 71, avgTime: "9pm-4am", lat: 40.6688, lng: -73.9416 },
    { name: "Park Slope", risk: 2, zone: "PKS", crimes: 16, avgTime: "9pm-2am", lat: 40.6710, lng: -73.9778 },
    { name: "Brooklyn Heights", risk: 2, zone: "BKH", crimes: 13, avgTime: "9pm-1am", lat: 40.6958, lng: -73.9936 },
    { name: "DUMBO", risk: 2, zone: "DMB", crimes: 11, avgTime: "9pm-2am", lat: 40.7033, lng: -73.9888 },
    { name: "Brownsville", risk: 9, zone: "BRN", crimes: 95, avgTime: "7pm-6am", lat: 40.6629, lng: -73.9121 },
    { name: "East New York", risk: 9, zone: "ENY", crimes: 98, avgTime: "All hours", lat: 40.6590, lng: -73.8823 },
    { name: "Sunset Park", risk: 5, zone: "SSP", crimes: 48, avgTime: "8pm-4am", lat: 40.6450, lng: -74.0155 },
    { name: "Bay Ridge", risk: 3, zone: "BRG", crimes: 24, avgTime: "10pm-2am", lat: 40.6260, lng: -74.0304 },
    { name: "Canarsie", risk: 7, zone: "CNR", crimes: 76, avgTime: "8pm-5am", lat: 40.6417, lng: -73.9008 }
  ],
  queens: [
    { name: "Astoria", risk: 3, zone: "AST", crimes: 29, avgTime: "10pm-3am", lat: 40.7644, lng: -73.9235 },
    { name: "Long Island City", risk: 3, zone: "LIC", crimes: 31, avgTime: "9pm-3am", lat: 40.7447, lng: -73.9485 },
    { name: "Flushing", risk: 4, zone: "FLG", crimes: 42, avgTime: "9pm-4am", lat: 40.7675, lng: -73.8333 },
    { name: "Jackson Heights", risk: 5, zone: "JKH", crimes: 55, avgTime: "8pm-4am", lat: 40.7557, lng: -73.8831 },
    { name: "Jamaica", risk: 8, zone: "JAM", crimes: 87, avgTime: "7pm-5am", lat: 40.6942, lng: -73.8064 },
    { name: "Far Rockaway", risk: 8, zone: "FRK", crimes: 89, avgTime: "All hours", lat: 40.6050, lng: -73.7552 },
    { name: "Forest Hills", risk: 2, zone: "FRH", crimes: 17, avgTime: "9pm-2am", lat: 40.7186, lng: -73.8448 },
    { name: "Bayside", risk: 2, zone: "BAY", crimes: 14, avgTime: "10pm-2am", lat: 40.7685, lng: -73.7782 },
    { name: "Elmhurst", risk: 4, zone: "ELM", crimes: 44, avgTime: "8pm-3am", lat: 40.7361, lng: -73.8778 },
    { name: "Corona", risk: 6, zone: "COR", crimes: 64, avgTime: "8pm-4am", lat: 40.7468, lng: -73.8617 },
    { name: "Ridgewood", risk: 4, zone: "RDG", crimes: 39, avgTime: "9pm-4am", lat: 40.7006, lng: -73.9062 },
    { name: "South Jamaica", risk: 9, zone: "SJM", crimes: 92, avgTime: "7pm-6am", lat: 40.6905, lng: -73.7939 }
  ]
};

const allNeighborhoods = [
  ...neighborhoods.manhattan,
  ...neighborhoods.brooklyn,
  ...neighborhoods.queens
];

const getRiskColor = (risk: number) => {
  if (risk <= 2) return 'bg-green-500';
  if (risk <= 4) return 'bg-yellow-500';
  if (risk <= 6) return 'bg-orange-500';
  if (risk <= 8) return 'bg-red-500';
  return 'bg-red-700';
};

const getRiskLabel = (risk: number) => {
  if (risk <= 2) return 'Low Risk';
  if (risk <= 4) return 'Moderate';
  if (risk <= 6) return 'Elevated';
  if (risk <= 8) return 'High Risk';
  return 'Critical';
};

const getRiskTextColor = (risk: number) => {
  if (risk <= 2) return 'text-green-600 dark:text-green-400';
  if (risk <= 4) return 'text-yellow-600 dark:text-yellow-400';
  if (risk <= 6) return 'text-orange-600 dark:text-orange-400';
  if (risk <= 8) return 'text-red-600 dark:text-red-400';
  return 'text-red-800 dark:text-red-300';
};

const getSafetyTips = (risk: number) => {
  if (risk <= 2) return ['Standard delivery procedures', 'Maintain situational awareness'];
  if (risk <= 4) return ['Stay in well-lit areas', 'Keep phone charged', 'Avoid alleys and shortcuts'];
  if (risk <= 6) return ['Travel in pairs if possible', 'Call customer upon arrival', 'Keep vehicle locked', 'Avoid late night deliveries'];
  if (risk <= 8) return ['HIGH ALERT: Consider declining after 10 PM', 'Never enter buildings alone', 'Park in visible locations', 'Share live location with dispatch'];
  return ['CRITICAL: Daytime delivery only recommended', 'Require customer to meet outside', 'Two-person delivery team required', 'Contact police non-emergency if suspicious activity'];
};

export default function AdminDeliverySafety() {
  const [selectedBorough, setSelectedBorough] = useState('all');
  const [sortBy, setSortBy] = useState('risk');

  const filteredNeighborhoods = selectedBorough === 'all' 
    ? allNeighborhoods 
    : neighborhoods[selectedBorough as keyof typeof neighborhoods];

  const sortedNeighborhoods = [...filteredNeighborhoods].sort((a, b) => {
    if (sortBy === 'risk') return b.risk - a.risk;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'crimes') return b.crimes - a.crimes;
    return 0;
  });

  const highRiskCount = allNeighborhoods.filter(n => n.risk >= 7).length;
  const avgRisk = (allNeighborhoods.reduce((sum, n) => sum + n.risk, 0) / allNeighborhoods.length).toFixed(1);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Delivery Safety Dashboard</h1>
          <p className="text-muted-foreground">AI-Powered Risk Assessment for Delivery Zones</p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Zones</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allNeighborhoods.length}</div>
              <p className="text-xs text-muted-foreground">Monitored areas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Risk</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgRisk}</div>
              <p className="text-xs text-muted-foreground">Across NYC</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk Zones</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{highRiskCount}</div>
              <p className="text-xs text-muted-foreground">Score 7+</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Safe Zones</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{allNeighborhoods.filter(n => n.risk <= 3).length}</div>
              <p className="text-xs text-muted-foreground">Score 1-3</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Borough</label>
                <Select value={selectedBorough} onValueChange={setSelectedBorough}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Boroughs</SelectItem>
                    <SelectItem value="manhattan">Manhattan</SelectItem>
                    <SelectItem value="brooklyn">Brooklyn</SelectItem>
                    <SelectItem value="queens">Queens</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk">Risk Score</SelectItem>
                    <SelectItem value="name">Neighborhood Name</SelectItem>
                    <SelectItem value="crimes">Crime Incidents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Legend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Risk Score Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded"></div>
                <span className="text-sm">1-2: Low Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-500 rounded"></div>
                <span className="text-sm">3-4: Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-500 rounded"></div>
                <span className="text-sm">5-6: Elevated</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-500 rounded"></div>
                <span className="text-sm">7-8: High Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-700 rounded"></div>
                <span className="text-sm">9-10: Critical</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Neighborhood List */}
        <Card>
          <CardHeader>
            <CardTitle>Neighborhood Risk Assessment</CardTitle>
            <CardDescription>Detailed safety information for all delivery zones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedNeighborhoods.map((neighborhood, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-20 h-20 ${getRiskColor(neighborhood.risk)} rounded-lg flex flex-col items-center justify-center text-white`}>
                          <div className="text-3xl font-bold">{neighborhood.risk}</div>
                          <div className="text-xs">/10</div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{neighborhood.name}</h3>
                          <Badge variant="outline" className="text-xs">Zone: {neighborhood.zone}</Badge>
                          <div className={`text-sm font-semibold mt-1 ${getRiskTextColor(neighborhood.risk)}`}>
                            {getRiskLabel(neighborhood.risk)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-destructive">{neighborhood.crimes}</div>
                        <div className="text-sm text-muted-foreground">Incidents/Month</div>
                        <div className="text-xs text-muted-foreground mt-1">Peak: {neighborhood.avgTime}</div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="font-semibold mb-2 text-sm">Safety Guidelines:</div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {getSafetyTips(neighborhood.risk).slice(0, 3).map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
