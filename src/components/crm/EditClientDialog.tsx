import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUpdateClient } from '@/hooks/crm/useClients';
import { useLogActivity } from '@/hooks/crm/useActivityLog';
import { logger } from '@/lib/logger';
import { Loader2, Pencil } from 'lucide-react';
import type { CRMClient } from '@/types/crm';

const formSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
    status: z.enum(['active', 'archived']),
});

type FormValues = z.infer<typeof formSchema>;

interface EditClientDialogProps {
    client: CRMClient;
}

export function EditClientDialog({ client }: EditClientDialogProps) {
    const [open, setOpen] = useState(false);
    const updateClient = useUpdateClient();
    const logActivity = useLogActivity();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: client.name,
            email: client.email || '',
            phone: client.phone || '',
            status: client.status,
        },
    });

    // Reset form when client changes
    useEffect(() => {
        if (client) {
            form.reset({
                name: client.name,
                email: client.email || '',
                phone: client.phone || '',
                status: client.status,
            });
        }
    }, [client, form]);

    const onSubmit = async (values: FormValues) => {
        try {
            await updateClient.mutateAsync({
                id: client.id,
                values: {
                    name: values.name,
                    email: values.email || undefined,
                    phone: values.phone || undefined,
                    status: values.status,
                },
            });

            // Log activity
            logActivity.mutate({
                client_id: client.id,
                activity_type: 'client_updated',
                description: `Client profile updated`,
                reference_id: client.id,
                reference_type: 'crm_clients',
            });

            setOpen(false);
        } catch (error: unknown) {
            logger.error('Failed to update client', error, { 
                component: 'EditClientDialog',
                clientId: client?.id 
            });
            // Error also handled by hook
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Profile
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Client</DialogTitle>
                    <DialogDescription>
                        Update client information and status.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email (Optional)</FormLabel>
                                    <FormControl>
                                        <Input type="email" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone (Optional)</FormLabel>
                                    <FormControl>
                                        <Input type="tel" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={updateClient.isPending}>
                                {updateClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
