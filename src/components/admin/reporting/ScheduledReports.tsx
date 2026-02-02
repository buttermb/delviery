import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Plus from "lucide-react/dist/esm/icons/plus";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

export function ScheduledReports() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scheduled Reports</CardTitle>
            <CardDescription>
              Automatically generate and deliver reports on a schedule
            </CardDescription>
          </div>
          <Button className="min-h-[44px] touch-manipulation">
            <Plus className="h-4 w-4 mr-2" />
            New Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No scheduled reports configured.</p>
          <p className="text-sm mt-2">
            Schedule reports to be automatically generated and emailed to stakeholders.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

