import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { SwipeableItem } from '@/components/mobile/SwipeableItem';
import { ProductDrawer } from '@/components/mobile/ProductDrawer';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Trash2, Archive, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { syncQueue } from '@/lib/sync-queue';

export default function MobileTestPage() {
    const [items, setItems] = useState([1, 2, 3, 4, 5]);
    const location = useGeolocation();
    const isOnline = useOnlineStatus();

    const handleRefresh = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setItems(prev => [Math.max(...prev) + 1, ...prev]);
        toast.success('Refreshed!');
    };

    const handleDelete = (id: number) => {
        setItems(prev => prev.filter(i => i !== id));
        toast.success(`Deleted item ${id}`);
    };

    const handleArchive = (id: number) => {
        toast.success(`Archived item ${id}`);
    };

    const handleOfflineAction = async () => {
        await syncQueue.add('/api/test-sync', 'POST', { timestamp: Date.now() });
        toast.success('Action queued (will sync when online)');
    };

    return (
        <div className="min-h-screen bg-muted/30 pb-20">
            <div className="p-4 space-y-6">
                <h1 className="text-2xl font-bold">Mobile Components Test</h1>

                {/* Network Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {isOnline ? <Wifi className="text-green-500" /> : <WifiOff className="text-red-500" />}
                            Network Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{isOnline ? 'Online' : 'Offline'}</p>
                        <Button onClick={handleOfflineAction} className="mt-2 w-full">
                            Test Offline Action (Sync Queue)
                        </Button>
                    </CardContent>
                </Card>

                {/* Geolocation */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Geolocation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {location.loading ? (
                            <p>Loading location...</p>
                        ) : location.error ? (
                            <p className="text-destructive">{location.error}</p>
                        ) : (
                            <div className="text-sm space-y-1">
                                <p>Lat: {location.latitude?.toFixed(6)}</p>
                                <p>Lng: {location.longitude?.toFixed(6)}</p>
                                <p>Accuracy: {location.accuracy?.toFixed(0)}m</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Product Drawer & Scanner */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Scanner & Drawer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ProductDrawer />
                    </CardContent>
                </Card>

                {/* Pull to Refresh & Swipeable List */}
                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg">Pull to Refresh & Swipe</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] overflow-y-auto border-t relative">
                        <PullToRefresh onRefresh={handleRefresh}>
                            <div className="divide-y">
                                {items.map(item => (
                                    <SwipeableItem
                                        key={item}
                                        leftAction={{
                                            label: 'Archive',
                                            icon: <Archive className="w-5 h-5 text-white" />,
                                            color: '#3b82f6', // blue-500
                                            onClick: () => handleArchive(item)
                                        }}
                                        rightAction={{
                                            label: 'Delete',
                                            icon: <Trash2 className="w-5 h-5 text-white" />,
                                            color: '#ef4444', // red-500
                                            onClick: () => handleDelete(item)
                                        }}
                                    >
                                        <div className="p-4 bg-background flex items-center justify-between">
                                            <span>Item {item}</span>
                                            <span className="text-xs text-muted-foreground">Swipe L/R</span>
                                        </div>
                                    </SwipeableItem>
                                ))}
                                {items.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No items. Pull to refresh.
                                    </div>
                                )}
                            </div>
                        </PullToRefresh>
                    </div>
                </Card>
            </div>
        </div>
    );
}
