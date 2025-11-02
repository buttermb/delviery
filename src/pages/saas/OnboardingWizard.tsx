/**
 * Onboarding Wizard
 * Multi-step onboarding flow for new tenants
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, ArrowRight, ArrowLeft, Upload, FileText, Link2, SkipForward } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

const STEPS = [
  { id: 1, name: 'Business Info', icon: '🏢' },
  { id: 2, name: 'Compliance', icon: '📜' },
  { id: 3, name: 'Products', icon: '📦' },
  { id: 4, name: 'Team', icon: '👥' },
  { id: 5, name: 'Complete', icon: '✅' },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant, refresh } = useTenant();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCSVDialog, setShowCSVDialog] = useState(false);

  // Step 1: Business Info
  const [businessInfo, setBusinessInfo] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    license_number: '',
    license_file: null as File | null,
  });

  // Step 2: Compliance
  const [compliance, setCompliance] = useState({
    state_license: '',
    license_expiration: '',
    license_document: null as File | null,
    certified: false,
  });

  // Step 4: Team
  const [teamMembers, setTeamMembers] = useState<Array<{ email: string; role: string }>>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = async () => {
    if (currentStep < STEPS.length) {
      // Validate and save step data
      if (currentStep === 1) {
        if (!businessInfo.address || !businessInfo.city || !businessInfo.state || !businessInfo.zip) {
          toast({
            title: 'Incomplete Information',
            description: 'Please fill in all business details',
            variant: 'destructive',
          });
          return;
        }
        // Save business info to tenant
        await saveBusinessInfo();
      } else if (currentStep === 2) {
        if (!compliance.certified) {
          toast({
            title: 'Certification Required',
            description: 'You must certify that this is a legal operation',
            variant: 'destructive',
          });
          return;
        }
        await saveCompliance();
      }

      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const saveBusinessInfo = async () => {
    if (!tenant?.id) return;

    try {
      await supabase
        .from('tenants')
        .update({
          // Store business info in metadata or create a separate table
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);
    } catch (error) {
      console.error('Failed to save business info:', error);
    }
  };

  const saveCompliance = async () => {
    if (!tenant?.id) return;

    try {
      const stateLicenses = [
        {
          state: businessInfo.state,
          license: compliance.state_license,
          expires: compliance.license_expiration,
        },
      ];

      await supabase
        .from('tenants')
        .update({
          state_licenses: stateLicenses,
          compliance_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      refresh();
    } catch (error) {
      console.error('Failed to save compliance:', error);
    }
  };

  const handleImportProducts = async (method: 'manual' | 'csv' | 'api') => {
    if (method === 'csv') {
      setShowCSVDialog(true);
      return;
    }

    if (method === 'manual') {
      navigate('/admin/products?action=new');
      return;
    }

    if (method === 'api') {
      toast({
        title: 'API Integration',
        description: 'API integration setup coming soon',
      });
      return;
    }
  };

  const handleAddTeamMember = () => {
    if (!newMemberEmail || !newMemberEmail.includes('@')) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setTeamMembers([...teamMembers, { email: newMemberEmail, role: newMemberRole }]);
    setNewMemberEmail('');
    setNewMemberRole('viewer');
  };

  const handleSendInvites = async () => {
    if (!tenant?.id) return;

    setIsSubmitting(true);
    try {
      const invites = teamMembers.map((member) => ({
        tenant_id: tenant.id,
        email: member.email,
        name: member.name || member.email.split('@')[0],
        role: member.role,
        status: 'pending',
        invited_at: new Date().toISOString(),
      } as any));

      const { error } = await supabase.from('tenant_users').insert(invites);

      if (error) throw error;

      toast({
        title: 'Invites Sent',
        description: `Invited ${teamMembers.length} team member(s)`,
      });

      setTeamMembers([]);
      handleNext();
    } catch (error: any) {
      toast({
        title: 'Failed to Send Invites',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!tenant?.id) return;

    setIsSubmitting(true);
    try {
      await supabase
        .from('tenants')
        .update({
          onboarded: true,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      refresh();

      toast({
        title: '🎉 Onboarding Complete!',
        description: 'Your account is ready to use',
      });

      navigate('/admin/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-muted'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step.id}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      currentStep > step.id ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
          <div className="mt-4 text-center">
            <h2 className="text-xl font-semibold">
              {STEPS[currentStep - 1].icon} {STEPS[currentStep - 1].name}
            </h2>
          </div>
        </Card>

        {/* Step Content */}
        <Card className="p-8">
          {/* Step 1: Business Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Tell us about your business</h3>
                <p className="text-muted-foreground">
                  We'll use this information for compliance and delivery addresses
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Input
                    id="address"
                    value={businessInfo.address}
                    onChange={(e) =>
                      setBusinessInfo({ ...businessInfo, address: e.target.value })
                    }
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={businessInfo.city}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, city: e.target.value })}
                    placeholder="New York"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={businessInfo.state}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, state: e.target.value })}
                    placeholder="NY"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={businessInfo.zip}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, zip: e.target.value })}
                    placeholder="10001"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="license">Business License # (Optional)</Label>
                  <Input
                    id="license"
                    value={businessInfo.license_number}
                    onChange={(e) =>
                      setBusinessInfo({ ...businessInfo, license_number: e.target.value })
                    }
                    placeholder="LIC-123456"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Compliance */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Compliance Information</h3>
                <p className="text-muted-foreground">
                  To ensure legal operation, we need your state license information
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="state_license">State License Number *</Label>
                  <Input
                    id="state_license"
                    value={compliance.state_license}
                    onChange={(e) =>
                      setCompliance({ ...compliance, state_license: e.target.value })
                    }
                    placeholder="C11-0000001"
                  />
                </div>
                <div>
                  <Label htmlFor="expiration">License Expiration Date *</Label>
                  <Input
                    id="expiration"
                    type="date"
                    value={compliance.license_expiration}
                    onChange={(e) =>
                      setCompliance({ ...compliance, license_expiration: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="license_doc">License Document (PDF)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="license_doc"
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        setCompliance({
                          ...compliance,
                          license_document: e.target.files?.[0] || null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2 p-4 border rounded-lg">
                  <input
                    type="checkbox"
                    id="certified"
                    checked={compliance.certified}
                    onChange={(e) =>
                      setCompliance({ ...compliance, certified: e.target.checked })
                    }
                    className="mt-1"
                  />
                  <Label htmlFor="certified" className="font-normal cursor-pointer">
                    I certify that this is a legal wholesale cannabis operation and I have the
                    necessary licenses to operate in my state.
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Products */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Add Your First Products</h3>
                <p className="text-muted-foreground">
                  Get started by adding products to your catalog
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                  className="p-6 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleImportProducts('manual')}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">➕</div>
                    <h4 className="font-semibold mb-2">Add Manually</h4>
                    <p className="text-sm text-muted-foreground">
                      Create products one at a time
                    </p>
                  </div>
                </Card>

                <Card
                  className="p-6 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleImportProducts('csv')}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">📄</div>
                    <h4 className="font-semibold mb-2">Import CSV</h4>
                    <p className="text-sm text-muted-foreground">
                      Upload a spreadsheet of products
                    </p>
                  </div>
                </Card>

                <Card
                  className="p-6 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleImportProducts('api')}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">🔌</div>
                    <h4 className="font-semibold mb-2">Connect System</h4>
                    <p className="text-sm text-muted-foreground">
                      Sync from existing system
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Step 4: Team */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Invite Your Team</h3>
                <p className="text-muted-foreground">
                  Add team members to help manage your operation
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Email Address"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTeamMember()}
                  />
                  <select
                    className="px-3 border rounded-md"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="runner">Runner</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button onClick={handleAddTeamMember}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>

                {teamMembers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Pending Invites:</h4>
                    {teamMembers.map((member, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <span className="font-medium">{member.email}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({member.role})
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setTeamMembers(teamMembers.filter((_, i) => i !== index))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button onClick={handleSendInvites} disabled={isSubmitting}>
                      Send Invites ({teamMembers.length})
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 5 && (
            <div className="space-y-6 text-center">
              <div>
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold mb-2">You're All Set!</h3>
                <p className="text-muted-foreground">
                  Your account is ready. Here's what to do next:
                </p>
              </div>

              <div className="space-y-3 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <span>Add more products</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <span>Create your first menu</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <span>Import customers</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <span>Set up locations</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <span>Customize branding</span>
                </div>
              </div>

              <Button
                onClick={handleComplete}
                disabled={isSubmitting}
                size="lg"
                className="mt-6"
              >
                {isSubmitting ? 'Completing...' : 'Go to Dashboard'}
              </Button>

              <div className="pt-4">
                <Button variant="link" onClick={() => window.open('/tutorials', '_blank')}>
                  📚 Watch Tutorial Videos
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {currentStep < STEPS.length && (
            <div className="flex justify-between mt-8 pt-6 border-t">
              <div>
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep < STEPS.length && (
                  <Button variant="ghost" onClick={handleSkip}>
                    <SkipForward className="h-4 w-4 mr-2" />
                    Skip
                  </Button>
                )}
                {currentStep === 4 && teamMembers.length > 0 ? (
                  <Button onClick={handleSendInvites} disabled={isSubmitting}>
                    Send Invites & Continue
                  </Button>
                ) : (
                  <Button onClick={handleNext}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* CSV Import Dialog */}
      <Dialog open={showCSVDialog} onOpenChange={setShowCSVDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Products from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with your products. Required columns: name, price, category
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".csv" />
            <Button onClick={() => setShowCSVDialog(false)} className="w-full">
              Upload & Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

