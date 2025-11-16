// NYC Neighborhoods with safety risk scores and delivery data
export interface Neighborhood {
  name: string;
  borough: string;
  risk: number;
  zipcodes: string[];
  crimes: number;
  avgTime: string;
}

export const neighborhoods: Neighborhood[] = [
  // Manhattan
  { name: "Upper East Side", borough: "Manhattan", risk: 2, zipcodes: ["10021", "10028", "10044", "10065", "10075", "10128"], crimes: 12, avgTime: "8pm-2am" },
  { name: "Upper West Side", borough: "Manhattan", risk: 2, zipcodes: ["10023", "10024", "10025"], crimes: 15, avgTime: "9pm-3am" },
  { name: "Midtown", borough: "Manhattan", risk: 4, zipcodes: ["10001", "10018", "10019", "10020", "10036"], crimes: 45, avgTime: "All hours" },
  { name: "Chelsea", borough: "Manhattan", risk: 3, zipcodes: ["10001", "10011", "10014"], crimes: 28, avgTime: "10pm-4am" },
  { name: "Greenwich Village", borough: "Manhattan", risk: 3, zipcodes: ["10003", "10012", "10013", "10014"], crimes: 22, avgTime: "9pm-2am" },
  { name: "East Village", borough: "Manhattan", risk: 4, zipcodes: ["10003", "10009"], crimes: 38, avgTime: "10pm-4am" },
  { name: "Lower East Side", borough: "Manhattan", risk: 5, zipcodes: ["10002", "10009"], crimes: 52, avgTime: "10pm-5am" },
  { name: "Harlem", borough: "Manhattan", risk: 7, zipcodes: ["10026", "10027", "10030", "10037", "10039"], crimes: 78, avgTime: "9pm-5am" },
  { name: "Washington Heights", borough: "Manhattan", risk: 6, zipcodes: ["10032", "10033", "10040"], crimes: 65, avgTime: "8pm-4am" },
  { name: "Inwood", borough: "Manhattan", risk: 6, zipcodes: ["10034", "10040"], crimes: 58, avgTime: "9pm-3am" },
  { name: "Battery Park", borough: "Manhattan", risk: 2, zipcodes: ["10004", "10280"], crimes: 18, avgTime: "10pm-2am" },
  { name: "Tribeca", borough: "Manhattan", risk: 2, zipcodes: ["10007", "10013"], crimes: 14, avgTime: "9pm-1am" },
  
  // Brooklyn
  { name: "Williamsburg", borough: "Brooklyn", risk: 3, zipcodes: ["11211", "11206"], crimes: 32, avgTime: "10pm-4am" },
  { name: "Bushwick", borough: "Brooklyn", risk: 6, zipcodes: ["11221", "11237"], crimes: 68, avgTime: "9pm-5am" },
  { name: "Bedford-Stuyvesant", borough: "Brooklyn", risk: 7, zipcodes: ["11205", "11206", "11216", "11221", "11233"], crimes: 82, avgTime: "8pm-5am" },
  { name: "Crown Heights", borough: "Brooklyn", risk: 6, zipcodes: ["11213", "11225", "11238"], crimes: 71, avgTime: "9pm-4am" },
  { name: "Park Slope", borough: "Brooklyn", risk: 2, zipcodes: ["11215", "11217"], crimes: 16, avgTime: "9pm-2am" },
  { name: "Brooklyn Heights", borough: "Brooklyn", risk: 2, zipcodes: ["11201"], crimes: 13, avgTime: "9pm-1am" },
  { name: "DUMBO", borough: "Brooklyn", risk: 2, zipcodes: ["11201"], crimes: 11, avgTime: "9pm-2am" },
  { name: "Brownsville", borough: "Brooklyn", risk: 9, zipcodes: ["11212"], crimes: 95, avgTime: "7pm-6am" },
  { name: "East New York", borough: "Brooklyn", risk: 9, zipcodes: ["11207", "11208"], crimes: 98, avgTime: "All hours" },
  { name: "Sunset Park", borough: "Brooklyn", risk: 5, zipcodes: ["11220", "11232"], crimes: 48, avgTime: "8pm-4am" },
  { name: "Bay Ridge", borough: "Brooklyn", risk: 3, zipcodes: ["11209"], crimes: 24, avgTime: "10pm-2am" },
  { name: "Canarsie", borough: "Brooklyn", risk: 7, zipcodes: ["11236"], crimes: 76, avgTime: "8pm-5am" },
  
  // Queens
  { name: "Astoria", borough: "Queens", risk: 3, zipcodes: ["11102", "11103", "11105", "11106"], crimes: 29, avgTime: "10pm-3am" },
  { name: "Long Island City", borough: "Queens", risk: 3, zipcodes: ["11101", "11109"], crimes: 31, avgTime: "9pm-3am" },
  { name: "Flushing", borough: "Queens", risk: 4, zipcodes: ["11354", "11355", "11358"], crimes: 42, avgTime: "9pm-4am" },
  { name: "Jackson Heights", borough: "Queens", risk: 5, zipcodes: ["11372", "11370"], crimes: 55, avgTime: "8pm-4am" },
  { name: "Jamaica", borough: "Queens", risk: 8, zipcodes: ["11432", "11433", "11434", "11435", "11436"], crimes: 87, avgTime: "7pm-5am" },
  { name: "Far Rockaway", borough: "Queens", risk: 8, zipcodes: ["11691", "11692", "11693", "11694", "11697"], crimes: 89, avgTime: "All hours" },
  { name: "Forest Hills", borough: "Queens", risk: 2, zipcodes: ["11375"], crimes: 17, avgTime: "9pm-2am" },
  { name: "Bayside", borough: "Queens", risk: 2, zipcodes: ["11360", "11361"], crimes: 14, avgTime: "10pm-2am" },
  { name: "Elmhurst", borough: "Queens", risk: 4, zipcodes: ["11373"], crimes: 44, avgTime: "8pm-3am" },
  { name: "Corona", borough: "Queens", risk: 6, zipcodes: ["11368"], crimes: 64, avgTime: "8pm-4am" },
  { name: "Ridgewood", borough: "Queens", risk: 4, zipcodes: ["11385"], crimes: 39, avgTime: "9pm-4am" },
  { name: "South Jamaica", borough: "Queens", risk: 9, zipcodes: ["11433", "11434"], crimes: 92, avgTime: "7pm-6am" }
];

export const getNeighborhoodFromZip = (zipcode: string): Neighborhood | null => {
  return neighborhoods.find(n => n.zipcodes.includes(zipcode)) || null;
};

export const getRiskColor = (risk: number): string => {
  if (risk <= 2) return 'bg-green-500';
  if (risk <= 4) return 'bg-yellow-500';
  if (risk <= 6) return 'bg-orange-500';
  if (risk <= 8) return 'bg-red-500';
  return 'bg-red-700';
};

export const getRiskLabel = (risk: number): string => {
  if (risk <= 2) return 'Low Risk';
  if (risk <= 4) return 'Moderate';
  if (risk <= 6) return 'Elevated';
  if (risk <= 8) return 'High Risk';
  return 'Critical';
};

export const getRiskTextColor = (risk: number): string => {
  if (risk <= 2) return 'text-green-600 dark:text-green-400';
  if (risk <= 4) return 'text-yellow-600 dark:text-yellow-400';
  if (risk <= 6) return 'text-orange-600 dark:text-orange-400';
  if (risk <= 8) return 'text-red-600 dark:text-red-400';
  return 'text-red-800 dark:text-red-600';
};

export const getSafetyTips = (risk: number): string[] => {
  if (risk <= 2) return ['Standard delivery procedures', 'Maintain situational awareness'];
  if (risk <= 4) return ['Stay in well-lit areas', 'Keep phone charged', 'Avoid alleys and shortcuts'];
  if (risk <= 6) return ['Travel in pairs if possible', 'Call customer upon arrival', 'Keep vehicle locked', 'Avoid late night deliveries'];
  if (risk <= 8) return ['HIGH ALERT: Consider declining after 10 PM', 'Never enter buildings alone', 'Park in visible locations', 'Share live location with dispatch'];
  return ['CRITICAL: Daytime delivery only recommended', 'Require customer to meet outside', 'Two-person delivery team required', 'Contact police non-emergency if suspicious activity'];
};
