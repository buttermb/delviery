import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, Users, CheckCircle2, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useCreditGatedAction } from "@/hooks/useCredits";
import { getCreditCost } from "@/lib/credits";
import { OutOfCreditsModal } from "@/components/credits/OutOfCreditsModal";

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedCustomerIds?: string[];
}

type EmailTemplate = "welcome" | "promotion" | "announcement" | "custom";

const EMAIL_TEMPLATES: Record<
  EmailTemplate,
  { subject: string; body: string }
> = {
  welcome: {
    subject: "Welcome to {business_name}!",
    body: "Hi {customer_name},\n\nThank you for choosing us. We're excited to serve you!\n\nBest regards,\n{business_name}",
  },
  promotion: {
    subject: "Special Offer Just for You!",
    body: "Hi {customer_name},\n\nWe have a special promotion we think you'll love.\n\n[Insert details here]\n\nBest regards,\n{business_name}",
  },
  announcement: {
    subject: "Important Update from {business_name}",
    body: "Hi {customer_name},\n\nWe wanted to let you know about an important update.\n\n[Insert details here]\n\nBest regards,\n{business_name}",
  },
  custom: {
    subject: "",
    body: "",
  },
};

export function BulkEmailDialog({
  open,
  onOpenChange,
  preSelectedCustomerIds = [],
}: BulkEmailDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const { execute: executeCreditAction, isPerforming } = useCreditGatedAction();
  const [template, setTemplate] = useState<EmailTemplate>("custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>(
    preSelectedCustomerIds
  );
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [showOutOfCredits, setShowOutOfCredits] = useState(false);

  const perRecipientCost = getCreditCost("send_bulk_email");
  const totalCreditCost = selectedCustomers.length * perRecipientCost;

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: queryKeys.customers.list(tenant?.id ?? ""),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email")
        .eq("tenant_id", tenant.id)
        .not("email", "is", null)
        .order("first_name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  const handleTemplateChange = (value: EmailTemplate) => {
    setTemplate(value);
    const templateData = EMAIL_TEMPLATES[value];
    setSubject(templateData.subject);
    setBody(templateData.body);
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const toggleAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map((c) => c.id));
    }
  };

  const handleSend = async () => {
    if (!tenant?.id || selectedCustomers.length === 0) {
      toast.error("Please select at least one customer");
      return;
    }

    if (!subject.trim() || !body.trim()) {
      toast.error("Please fill in subject and body");
      return;
    }

    setIsSending(true);

    const result = await executeCreditAction("send_bulk_email", async () => {
      const selectedCustomerData = customers.filter((c) =>
        selectedCustomers.includes(c.id)
      );

      const emailPromises = selectedCustomerData.map(async (customer) => {
        const personalizedSubject = subject
          .replace("{business_name}", tenant.business_name)
          .replace(
            "{customer_name}",
            `${customer.first_name} ${customer.last_name}`
          );

        const personalizedBody = body
          .replace("{business_name}", tenant.business_name)
          .replace(
            "{customer_name}",
            `${customer.first_name} ${customer.last_name}`
          );

        logger.info("Sending email", {
          to: customer.email,
          subject: personalizedSubject,
          body: personalizedBody,
          component: "BulkEmailDialog",
        });

        await supabase.from("email_logs").insert({
          tenant_id: tenant.id,
          customer_id: customer.id,
          subject: personalizedSubject,
          body: personalizedBody,
          status: "queued",
          sent_at: new Date().toISOString(),
        });
      });

      await Promise.all(emailPromises);
    }, {
      onInsufficientCredits: () => setShowOutOfCredits(true),
    });

    if (result === null) {
      // Credit gate blocked or action failed
      setIsSending(false);
      return;
    }

    setIsSent(true);
    toast.success("Emails queued successfully!", {
      description: `${selectedCustomers.length} email${selectedCustomers.length > 1 ? "s" : ""} will be sent shortly.`,
    });

    setTimeout(() => {
      setIsSent(false);
      setSelectedCustomers([]);
      setSubject("");
      setBody("");
      setTemplate("custom");
      onOpenChange(false);
    }, 2000);

    setIsSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Bulk Email
          </DialogTitle>
          <DialogDescription>
            Send personalized emails to multiple customers at once.
          </DialogDescription>
        </DialogHeader>

        {isSent ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Emails Queued!</p>
              <p className="text-sm text-muted-foreground">
                Your emails will be sent shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label>Email Template</Label>
              <Select value={template} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Email</SelectItem>
                  <SelectItem value="welcome">Welcome Email</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{business_name}"} and {"{customer_name}"} for
                personalization
              </p>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email body..."
                rows={6}
                disabled={isSending}
              />
            </div>

            {/* Estimated Credit Cost */}
            {selectedCustomers.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30" data-testid="credit-cost-estimate">
                <Coins className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm">
                  Estimated cost:{" "}
                  <span className="font-semibold">
                    {selectedCustomers.length} recipient{selectedCustomers.length !== 1 ? "s" : ""} × {perRecipientCost} credits = {totalCreditCost} credits
                  </span>
                </span>
              </div>
            )}

            {/* Recipients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recipients</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedCustomers.length} selected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAll}
                    disabled={isSending}
                  >
                    {selectedCustomers.length === customers.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                {customers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No customers with email addresses found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customers.map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                      >
                        <Checkbox
                          id={customer.id}
                          checked={selectedCustomers.includes(customer.id)}
                          onCheckedChange={() => toggleCustomer(customer.id)}
                          disabled={isSending}
                        />
                        <Label
                          htmlFor={customer.id}
                          className="flex-1 cursor-pointer"
                        >
                          <span className="font-medium">
                            {customer.first_name} {customer.last_name}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {customer.email}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending || isPerforming || isSent}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              isSending ||
              isPerforming ||
              isSent ||
              selectedCustomers.length === 0 ||
              !subject.trim() ||
              !body.trim()
            }
          >
            {isSending || isPerforming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send to {selectedCustomers.length} customer
                {selectedCustomers.length !== 1 ? "s" : ""}
                {totalCreditCost > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {totalCreditCost} cr
                  </Badge>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <OutOfCreditsModal
        open={showOutOfCredits}
        onOpenChange={setShowOutOfCredits}
        actionAttempted="send_bulk_email"
      />
    </Dialog>
  );
}
