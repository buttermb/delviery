import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  total_spent: number;
  last_purchase_at: string | null;
  rfm: { r: number; f: number; m: number; rfm: string };
}

interface RFMAnalysisProps {
  customers: Customer[];
}

export function RFMAnalysis({ customers }: RFMAnalysisProps) {
  // Group by RFM score
  const rfmGroups: Record<string, Customer[]> = {};
  customers.forEach((customer) => {
    const key = customer.rfm.rfm;
    if (!rfmGroups[key]) {
      rfmGroups[key] = [];
    }
    rfmGroups[key].push(customer);
  });

  const topRFMScores = Object.entries(rfmGroups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>RFM Analysis</CardTitle>
        <CardDescription>
          Recency, Frequency, Monetary value scoring (5 = best, 1 = worst)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recency (R)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Days since last purchase. Lower is better.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Frequency (F)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Number of purchases. Higher is better.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Monetary (M)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Total amount spent. Higher is better.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFM Score</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Avg Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRFMScores.map(([score, customers]) => (
                  <TableRow key={score}>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {score}
                      </code>
                    </TableCell>
                    <TableCell>{customers.length}</TableCell>
                    <TableCell>
                      ${customers
                        .reduce((sum, c) => sum + c.total_spent, 0)
                        .toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    </TableCell>
                    <TableCell>
                      ${(
                        customers.reduce((sum, c) => sum + c.total_spent, 0) /
                        customers.length
                      ).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

