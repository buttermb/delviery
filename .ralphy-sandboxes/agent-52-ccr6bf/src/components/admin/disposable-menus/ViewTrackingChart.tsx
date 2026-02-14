import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ViewTrackingChartProps {
  data: Array<{
    date: string;
    views: number;
    uniqueVisitors: number;
  }>;
}

export const ViewTrackingChart = ({ data }: ViewTrackingChartProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Views Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="views" fill="hsl(var(--primary))" name="Total Views" />
          <Bar dataKey="uniqueVisitors" fill="hsl(var(--secondary))" name="Unique Visitors" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};