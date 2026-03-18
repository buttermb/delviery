/**
 * BuilderMobileDrawer
 * Bottom sheet drawer using vaul for mobile builder panel navigation.
 * Wraps any child content in a mobile-friendly drawer.
 */

import { Drawer } from 'vaul';

interface BuilderMobileDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: React.ReactNode;
}

export function BuilderMobileDrawer({
    open,
    onOpenChange,
    title,
    children,
}: BuilderMobileDrawerProps) {
    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background border-t focus:outline-none max-h-[85vh]">
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted-foreground/20 mt-3 mb-2" />
                    <Drawer.Title className="px-4 pb-2 text-sm font-semibold border-b">
                        {title}
                    </Drawer.Title>
                    <div className="overflow-y-auto flex-1 pb-safe">
                        {children}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
