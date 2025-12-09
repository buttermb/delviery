import { logger } from '@/lib/logger';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: (clientId: string) => void;
}

export function CreateWholesaleClientDialog({ open, onClose, onSuccess }: Props) {
    const { tenant } = useTenantAdminAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        business_name: '',
        contact_name: '',
        email: '',
        phone: '',
        license_number: '',
        payment_terms: 'net_30',
        address: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!tenant?.id) {
            toast.error('No tenant context found');
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await (supabase as any)
                .from('wholesale_clients')
                .insert({
                    tenant_id: tenant.id,
                    business_name: formData.business_name,
                    contact_name: formData.contact_name,
                    email: formData.email,
                    phone: formData.phone,
                    license_number: formData.license_number || 'PENDING',
                    payment_terms: parseInt(formData.payment_terms === 'cod' ? '0' : formData.payment_terms === 'net_7' ? '7' : formData.payment_terms === 'net_15' ? '15' : '30'),
                    address: formData.address,
                    client_type: 'retail',
                    credit_limit: 0,
                    outstanding_balance: 0,
                    reliability_score: 100,
                    monthly_volume: 0,
                    status: 'active',
                })
                .select()
                .maybeSingle();

            if (error) throw error;

            toast.success('Client created successfully');
            onSuccess(data.id);

            // Reset form
            setFormData({
                business_name: '',
                contact_name: '',
                email: '',
                phone: '',
                license_number: '',
                payment_terms: 'net_30',
                address: ''
            });
            onClose();
        } catch (error: any) {
            logger.error('Failed to create client:', error);
            toast.error(error.message || 'Failed to create client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Wholesale Client</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="business_name">Business Name *</Label>
                            <Input
                                id="business_name"
                                value={formData.business_name}
                                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                required
                                placeholder="e.g. Green Dispensary"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact_name">Contact Name</Label>
                            <Input
                                id="contact_name"
                                value={formData.contact_name}
                                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="license_number">License Number *</Label>
                        <Input
                            id="license_number"
                            value={formData.license_number}
                            onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                            placeholder="e.g. C11-0000123-LIC"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="billing@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Delivery Address</Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="123 Main St, City, State"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="payment_terms">Payment Terms</Label>
                        <Select
                            value={formData.payment_terms}
                            onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select terms" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cod">Cash on Delivery (COD)</SelectItem>
                                <SelectItem value="net_7">Net 7</SelectItem>
                                <SelectItem value="net_15">Net 15</SelectItem>
                                <SelectItem value="net_30">Net 30</SelectItem>
                                <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Client'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
