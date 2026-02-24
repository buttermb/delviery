import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { REPORT_TYPES, REPORT_FIELDS, DATE_RANGES, SCHEDULE_OPTIONS, ReportField } from '@/lib/constants/reportFields';
import { Plus, X, Calendar, Mail } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';

export function ReportBuilder({ onClose }: { onClose?: () => void }) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState<string>('pos');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState('month');
  const [schedule, setSchedule] = useState('none');
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  const availableFields = REPORT_FIELDS[reportType] || [];
  
  // Group fields by category
  const fieldsByCategory = availableFields.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, ReportField[]>);

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(f => f !== fieldId)
        : [...prev, fieldId]
    );
  };

  const addEmail = () => {
    if (newEmail && !emailRecipients.includes(newEmail)) {
      setEmailRecipients([...emailRecipients, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  const createReportMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');
      const user = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('custom_reports')
        .insert({
          tenant_id: tenantId,
          created_by: user.data.user?.id,
          name,
          description,
          report_type: reportType,
          selected_fields: selectedFields,
          date_range: dateRange,
          schedule,
          email_recipients: emailRecipients.length > 0 ? emailRecipients : null,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customReports.byTenant(tenantId) });
      toast.success('Your custom report has been saved.');
      onClose?.();
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error));
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Custom Report</CardTitle>
          <CardDescription>Configure your report settings and select fields to include</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Report Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Daily Sales Report"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this report"
              />
            </div>

            <div>
              <Label htmlFor="type">Report Type</Label>
              <Select value={reportType} onValueChange={(value) => {
                setReportType(value);
                setSelectedFields([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map(range => (
                    <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Field Selection */}
          <div>
            <Label className="mb-3 block">Select Fields to Include</Label>
            <div className="space-y-4">
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold mb-2">{category}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map(field => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={field.id}
                          checked={selectedFields.includes(field.id)}
                          onCheckedChange={() => toggleField(field.id)}
                        />
                        <label
                          htmlFor={field.id}
                          className="text-sm cursor-pointer"
                        >
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Selected: {selectedFields.length} fields
            </p>
          </div>

          {/* Scheduling */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label htmlFor="schedule" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule (Optional)
              </Label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {schedule !== 'none' && (
              <div>
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Recipients
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@example.com"
                    onKeyPress={(e) => e.key === 'Enter' && addEmail()}
                  />
                  <Button type="button" onClick={addEmail} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {emailRecipients.map(email => (
                    <Badge key={email} variant="secondary" className="gap-2">
                      {email}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeEmail(email)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => createReportMutation.mutate()}
              disabled={!name || selectedFields.length === 0 || createReportMutation.isPending}
            >
              {createReportMutation.isPending ? 'Creating...' : 'Create Report'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
