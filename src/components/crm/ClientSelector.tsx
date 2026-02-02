import { useState } from "react";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronsUpDown from "lucide-react/dist/esm/icons/chevrons-up-down";
import Plus from "lucide-react/dist/esm/icons/plus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useClients } from "@/hooks/crm/useClients";
import { CreateClientDialog } from "./CreateClientDialog";

interface ClientSelectorProps {
    value?: string;
    onChange: (value: string) => void;
    error?: string;
}

export function ClientSelector({ value, onChange, error }: ClientSelectorProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const { data: clients, isLoading } = useClients();

    // Filter clients based on search query
    const filteredClients = clients?.filter((client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedClient = clients?.find((client) => client.id === value);

    return (
        <div className="flex flex-col gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between",
                            !value && "text-muted-foreground",
                            error && "border-destructive"
                        )}
                    >
                        {selectedClient ? selectedClient.name : "Select client..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Search clients..."
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                        />
                        <CommandList>
                            <CommandEmpty>
                                <div className="p-4 text-center">
                                    <p className="text-sm text-muted-foreground mb-2">No client found.</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCreateDialogOpen(true)}
                                        className="w-full"
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Create New Client
                                    </Button>
                                </div>
                            </CommandEmpty>
                            <CommandGroup>
                                {isLoading ? (
                                    <CommandItem disabled>Loading...</CommandItem>
                                ) : (
                                    filteredClients?.map((client) => (
                                        <CommandItem
                                            key={client.id}
                                            value={client.id}
                                            onSelect={(currentValue) => {
                                                onChange(currentValue === value ? "" : currentValue);
                                                setOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === client.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col">
                                                <span>{client.name}</span>
                                                {client.email && (
                                                    <span className="text-xs text-muted-foreground">{client.email}</span>
                                                )}
                                            </div>
                                        </CommandItem>
                                    ))
                                )}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {error && <p className="text-sm text-destructive">{error}</p>}

            <CreateClientDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSuccess={(newClientId) => {
                    onChange(newClientId); // Auto-select the new client
                    setOpen(false);
                }}
            />
        </div>
    );
}
