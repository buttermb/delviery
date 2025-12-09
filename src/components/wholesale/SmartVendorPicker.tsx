import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Search, Building2 } from 'lucide-react';
import { useVendors, Vendor, useCreateVendor } from '@/hooks/useVendors';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SmartVendorPickerProps {
    selectedVendor: Vendor | null;
    onSelect: (vendor: Vendor) => void;
    onClear?: () => void;
}

export function SmartVendorPicker({
    selectedVendor,
    onSelect,
    onClear,
}: SmartVendorPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const { data: vendors = [], isLoading } = useVendors();
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    const filteredVendors = useMemo(() => {
        if (!searchQuery) return vendors;
        const query = searchQuery.toLowerCase();
        return vendors.filter(
            (vendor) =>
                vendor.name.toLowerCase().includes(query) ||
                vendor.contact_name?.toLowerCase().includes(query)
        );
    }, [vendors, searchQuery]);

    if (selectedVendor) {
        return (
            <Card className="p-4 border-emerald-500/50 bg-emerald-500/5">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-500/20">
                            <Building2 className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">{selectedVendor.name}</h3>
                            <p className="text-sm text-muted-foreground">{selectedVendor.contact_name || 'No Contact Person'}</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={onClear}>
                        Change
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search vendors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <CreateVendorDialog
                    open={showCreateDialog}
                    onOpenChange={setShowCreateDialog}
                    onSuccess={(vendor) => {
                        onSelect(vendor);
                        setShowCreateDialog(false);
                    }}
                />
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredVendors.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No vendors found.
                        </div>
                    ) : (
                        filteredVendors.map((vendor) => (
                            <Card
                                key={vendor.id}
                                className="p-3 cursor-pointer hover:border-primary transition-colors flex items-center gap-3"
                                onClick={() => onSelect(vendor)}
                            >
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="font-medium">{vendor.name}</div>
                                    <div className="text-sm text-muted-foreground">{vendor.contact_name}</div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function CreateVendorDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: (vendor: Vendor) => void }) {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    const { mutate, isPending } = useCreateVendor();

    const handleSubmit = () => {
        if (!name) return;
        mutate({ name, contact_name: contact, email, phone }, {
            onSuccess: (data) => {
                toast.success("Vendor created");
                onSuccess(data as unknown as Vendor);
                setName('');
                setContact('');
                setEmail('');
                setPhone('');
            },
            onError: () => toast.error("Failed to create vendor")
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> New Vendor</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Vendor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Business Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Vendor Business Name" />
                    </div>
                    <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="Name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isPending || !name}>Create Vendor</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
