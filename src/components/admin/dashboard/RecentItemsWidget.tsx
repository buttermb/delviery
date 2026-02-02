import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentItems } from "@/hooks/useRecentItems";
import Clock from "lucide-react/dist/esm/icons/clock";
import Package from "lucide-react/dist/esm/icons/package";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Users from "lucide-react/dist/esm/icons/users";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function RecentItemsWidget() {
    const { items, clearRecentItems } = useRecentItems();
    const navigate = useNavigate();

    if (items.length === 0) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'order': return <ShoppingCart className="h-4 w-4 text-info" />;
            case 'product': return <Package className="h-4 w-4 text-warning" />;
            case 'client': return <Users className="h-4 w-4 text-success" />;
            default: return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    return (
        <Card className="col-span-full md:col-span-1 shadow-sm border-none bg-gradient-to-br from-card to-muted/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Items</CardTitle>
                <Button variant="ghost" size="sm" onClick={clearRecentItems} className="h-6 text-xs text-muted-foreground">
                    Clear
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    {items.map((item) => (
                        <div
                            key={`${item.type}-${item.id}`}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => navigate(item.path)}
                        >
                            <div className="p-2 bg-background rounded-md shadow-sm group-hover:shadow transition-shadow">
                                {getIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.label}</p>
                                {item.subLabel && (
                                    <p className="text-xs text-muted-foreground truncate">{item.subLabel}</p>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                Go
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
