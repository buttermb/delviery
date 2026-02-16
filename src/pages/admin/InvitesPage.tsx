import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useInvites, useCreateInvite, useArchiveInvite } from "@/hooks/crm/useInvites";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    client_id: z.string().optional(), // Optional if we want to link to existing client immediately
});

type FormValues = z.infer<typeof formSchema>;

export default function InvitesPage() {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

    const { data: invites, isLoading } = useInvites();
    const createInvite = useCreateInvite();
    const archiveInvite = useArchiveInvite();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
        },
    });

    const onSubmit = async (values: FormValues) => {
        try {
            await createInvite.mutateAsync({
                name: values.name,
                email: values.email,
                phone: undefined,
            });
            toast.success(`Invite sent to ${values.email}`);
            setIsCreateDialogOpen(false);
            form.reset();
        } catch {
            // Error handled by hook
        }
    };

    const handleArchive = (id: string, email: string) => {
        confirm({
            title: 'Archive Invite',
            description: `Are you sure you want to archive the invite for ${email}? They will no longer be able to use this invitation.`,
            itemType: 'invite',
            onConfirm: async () => {
                setLoading(true);
                try {
                    await archiveInvite.mutateAsync(id);
                    closeDialog();
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const filteredInvites = invites?.filter((invite) =>
        invite.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "accepted":
                return <Badge className="bg-green-500">Accepted</Badge>;
            case "pending":
                return <Badge className="bg-yellow-500">Pending</Badge>;
            case "expired":
                return <Badge variant="destructive">Expired</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6 p-6 pb-16 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Client Portal Invites</h1>
                    <p className="text-muted-foreground">
                        Manage invitations for clients to access the portal.
                    </p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Send Invite
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Send Portal Invite</DialogTitle>
                            <DialogDescription>
                                Send an email invitation to a client to join the portal.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel required>Name</FormLabel>
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
                                            <FormLabel required>Email Address</FormLabel>
                                            <FormControl>
                                                <Input placeholder="client@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="submit" disabled={createInvite.isPending}>
                                        {createInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <Mail className="mr-2 h-4 w-4" />
                                        Send Invite
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Invites</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : filteredInvites?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No invites found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Sent At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInvites?.map((invite) => (
                                    <TableRow key={invite.id}>
                                        <TableCell className="font-medium">{invite.name}</TableCell>
                                        <TableCell>{invite.email}</TableCell>
                                        <TableCell>{getStatusBadge(invite.status)}</TableCell>
                                        <TableCell>{format(new Date(invite.created_at), "MMM d, yyyy")}</TableCell>
                                        <TableCell className="text-right">
                                            {invite.status === "pending" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleArchive(invite.id, invite.email)}
                                                    title="Revoke Invite"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <ConfirmDeleteDialog
                open={dialogState.open}
                onOpenChange={(open) => !open && closeDialog()}
                onConfirm={dialogState.onConfirm}
                title={dialogState.title}
                description={dialogState.description}
                itemType={dialogState.itemType}
                isLoading={dialogState.isLoading}
                destructive={false}
            />
        </div>
    );
}
