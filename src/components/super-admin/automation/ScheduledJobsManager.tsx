/**
 * Scheduled Jobs Manager
 * Manage cron jobs and scheduled tasks
 * Inspired by Airflow and Temporal
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Clock, Play, Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  schedule: string; // Cron expression
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  status: 'idle' | 'running' | 'failed';
}

export function ScheduledJobsManager() {
  const { toast } = useToast();

  // Mock data - in production would come from database
  const { data: jobs } = useQuery({
    queryKey: ['scheduled-jobs'],
    queryFn: async () => {
      // In production, fetch from scheduled_jobs table
      const mockJobs: ScheduledJob[] = [
        {
          id: '1',
          name: 'Collect System Metrics',
          description: 'Collect platform metrics every minute',
          schedule: '*/1 * * * *',
          enabled: true,
          last_run_at: new Date().toISOString(),
          next_run_at: new Date(Date.now() + 60000).toISOString(),
          status: 'idle',
        },
        {
          id: '2',
          name: 'Uptime Checker',
          description: 'Check service availability',
          schedule: '*/5 * * * *',
          enabled: true,
          last_run_at: new Date(Date.now() - 300000).toISOString(),
          next_run_at: new Date(Date.now() + 120000).toISOString(),
          status: 'idle',
        },
        {
          id: '3',
          name: 'Security Scan',
          description: 'Daily security vulnerability scan',
          schedule: '0 2 * * *',
          enabled: true,
          last_run_at: new Date(Date.now() - 86400000).toISOString(),
          next_run_at: new Date().setHours(2, 0, 0, 0).toString(),
          status: 'idle',
        },
      ];
      return mockJobs;
    },
  });

  const toggleJob = async (_jobId: string, enabled: boolean) => {
    toast({
      title: enabled ? 'Job Enabled' : 'Job Disabled',
      description: `Scheduled job has been ${enabled ? 'enabled' : 'disabled'}`,
    });
  };

  const runJobNow = async (_jobId: string) => {
    toast({
      title: 'Job Started',
      description: 'Running scheduled job now...',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Job
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {jobs && jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{job.name}</p>
                        <p className="text-xs text-muted-foreground">{job.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{job.schedule}</TableCell>
                    <TableCell>
                      {job.last_run_at
                        ? format(new Date(job.last_run_at), 'MMM dd, HH:mm')
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {job.next_run_at
                        ? format(new Date(job.next_run_at), 'MMM dd, HH:mm')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          job.status === 'running'
                            ? 'default'
                            : job.status === 'failed'
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(checked) => toggleJob(job.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runJobNow(job.id)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No scheduled jobs configured</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

