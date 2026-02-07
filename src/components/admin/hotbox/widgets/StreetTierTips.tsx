import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function StreetTierTips() {
    const [dismissedTips, setDismissedTips] = useState<string[]>([]);

    const tips = [
        {
            id: 'add-products',
            emoji: '📦',
            title: 'Add your first products',
            description: 'Start by adding your inventory to the system',
            action: '/admin/products/new',
            actionLabel: 'Add Product',
        },
        {
            id: 'setup-menu',
            emoji: '📋',
            title: 'Create a Disposable Menu',
            description: 'Share product links with customers securely',
            action: '/admin/disposable-menus',
            actionLabel: 'Create Menu',
        },
        {
            id: 'first-sale',
            emoji: '💰',
            title: 'Make your first sale',
            description: 'Use the POS system for walk-in customers',
            action: '/admin/pos-system',
            actionLabel: 'Open POS',
        },
    ];

    const visibleTips = tips.filter(t => !dismissedTips.includes(t.id));

    if (visibleTips.length === 0) return null;

    return (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <span className="text-xl">💡</span> GETTING STARTED
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {visibleTips.map((tip) => (
                    <div
                        key={tip.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{tip.emoji}</span>
                            <div>
                                <div className="font-medium">{tip.title}</div>
                                <div className="text-sm text-muted-foreground">{tip.description}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link to={tip.action}>{tip.actionLabel}</Link>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDismissedTips([...dismissedTips, tip.id])}
                            >
                                ✕
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
