/**
 * Simple Map Visualization Component
 * Inspired by React Simple Maps - https://github.com/zcreativelabs/react-simple-maps
 * SVG-based maps - no API calls needed!
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { MapPin } from 'lucide-react';

interface Location {
  name: string;
  coordinates: [number, number];
  type: 'warehouse' | 'delivery' | 'customer';
}

interface SimpleMapVisualizationProps {
  locations?: Location[];
  title?: string;
}

// Simple US map (you can use actual geoJSON files)
const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

export function SimpleMapVisualization({ 
  locations = [], 
  title = 'Location Map' 
}: SimpleMapVisualizationProps) {
  // Default locations if none provided
  const defaultLocations: Location[] = locations.length > 0 ? locations : [
    { name: 'Warehouse 1', coordinates: [-74.006, 40.7128], type: 'warehouse' },
    { name: 'Delivery 1', coordinates: [-73.985, 40.7589], type: 'delivery' },
    { name: 'Customer 1', coordinates: [-73.977, 40.7514], type: 'customer' },
  ];

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'warehouse': return '#10b981';
      case 'delivery': return '#3b82f6';
      case 'customer': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[400px] rounded-lg border overflow-hidden">
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 1000 }}
            width={800}
            height={400}
          >
            <ZoomableGroup>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5e7eb"
                      stroke="#9ca3af"
                      strokeWidth={0.5}
                    />
                  ))
                }
              </Geographies>
              {defaultLocations.map((location, index) => (
                <Marker key={index} coordinates={location.coordinates}>
                  <circle
                    r={8}
                    fill={getMarkerColor(location.type)}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <text
                    textAnchor="middle"
                    y={-15}
                    style={{ fontFamily: 'system-ui', fill: '#333', fontSize: '12px' }}
                  >
                    {location.name}
                  </text>
                </Marker>
              ))}
            </ZoomableGroup>
          </ComposableMap>
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Warehouse</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Delivery</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Customer</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

