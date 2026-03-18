import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InvoiceFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    statusFilter: string | null;
    onStatusChange: (value: string | null) => void;
    dateRange: { from: string; to: string } | null;
    onDateRangeChange: (range: { from: string; to: string } | null) => void;
}

export function InvoiceFilters({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusChange,
    dateRange,
    onDateRangeChange
}: InvoiceFiltersProps) {
    return (
        <div className="flex flex-col md:flex-row gap-4 mb-6 mt-6">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by invoice number or customer name..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 w-full md:max-w-md"
                />
            </div>

            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <Select
                    value={statusFilter || "all"}
                    onValueChange={(val) => onStatusChange(val === "all" ? null : val)}
                >
                    <SelectTrigger className="w-[140px] shrink-0">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="void">Void / Cancelled</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 shrink-0">
                    <Input
                        type="date"
                        value={dateRange?.from || ""}
                        onChange={(e) => onDateRangeChange({
                            from: e.target.value,
                            to: dateRange?.to || ""
                        })}
                        className="w-[130px]"
                        aria-label="Start date"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                        type="date"
                        value={dateRange?.to || ""}
                        onChange={(e) => onDateRangeChange({
                            from: dateRange?.from || "",
                            to: e.target.value
                        })}
                        className="w-[130px]"
                        aria-label="End date"
                    />
                    {(dateRange?.from || dateRange?.to) && (
                        <button
                            type="button"
                            onClick={() => onDateRangeChange(null)}
                            className="text-xs text-muted-foreground hover:text-foreground px-2"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
