import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCreateClient } from '@/hooks/crm/useClients';
import { useLogActivity } from '@/hooks/crm/useActivityLog';
import { logger } from '@/lib/logger';
import { Plus, Loader2 } from 'lucide-react';

const formSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateClientDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: (clientId: string) => void;
}

export function CreateClientDialog({
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    onSuccess
}: CreateClientDialogProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

    const { account } = useAccount();
    const createClient = useCreateClient();
    const logActivity = useLogActivity();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
        },
    });

    const onSubmit = async (values: FormValues) => {
        if (!account?.id) {
            toast.error('Account information not available');
            return;
        }

        try {
            const client = await createClient.mutateAsync({
                account_id: account.id,
                name: values.name,
                email: values.email || undefined,
                phone: values.phone || undefined,
                status: 'active',
            });

            // Log activity
            logActivity.mutate({
                client_id: client.id,
                activity_type: 'client_created',
                description: `Client ${client.name} created`,
                reference_id: client.id,
                reference_type: 'crm_clients',
            });

            setOpen(false);
            form.reset();

            if (onSuccess) {
                onSuccess(client.id);
            }
        } catch (error: unknown) {
            logger.error('Failed to create client', error, { 
                component: 'CreateClientDialog',
                clientName: values.name 
            });
            // Error also handled by hook
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Client
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Client</DialogTitle>
                    <DialogDescription>
                        Create a new client profile. You can add more details later.
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
                                        <Input placeholder="John Doe" {...field} />
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
                                        <Input placeholder="john@example.com" type="email" {...field} />
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
                                        <Input placeholder="(555) 123-4567" type="tel" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={createClient.isPending}>
                                {createClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Client
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
