/**
 * ModeSwitchWarningDialog Component
 * Warning dialog when switching between Simple and Advanced modes
 */

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    AlertTriangle,
    Wand2,
    Settings2,
    CheckCircle2,
    XCircle,
} from 'lucide-react';

type SwitchDirection = 'simple-to-advanced' | 'advanced-to-simple';

interface ModeSwitchWarningDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    direction: SwitchDirection;
    customizations?: string[];
    onConfirm: () => void;
    onCancel: () => void;
}

export function ModeSwitchWarningDialog({
    open,
    onOpenChange,
    direction,
    customizations = [],
    onConfirm,
    onCancel,
}: ModeSwitchWarningDialogProps) {
    const isToAdvanced = direction === 'simple-to-advanced';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        {isToAdvanced ? (
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                <Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                        ) : (
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                        )}
                        <AlertDialogTitle>
                            {isToAdvanced
                                ? 'Switch to Advanced Mode?'
                                : 'Switch to Simple Mode?'
                            }
                        </AlertDialogTitle>
                    </div>

                    <AlertDialogDescription className="text-left space-y-4">
                        {isToAdvanced ? (
                            <>
                                <p>
                                    You&apos;ll get full control over your storefront with:
                                </p>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                        <span>Drag-and-drop section reordering</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                        <span>Custom HTML sections</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                        <span>Fine-grained style control per section</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                        <span>Responsive settings per device</span>
                                    </li>
                                </ul>
                                <p className="text-muted-foreground text-xs">
                                    Your current theme and content will be preserved.
                                </p>
                            </>
                        ) : (
                            <>
                                <p>
                                    Switching to Simple Mode will reset some of your customizations:
                                </p>
                                {customizations.length > 0 && (
                                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                                            The following will be lost:
                                        </p>
                                        <ul className="space-y-1">
                                            {customizations.map((item, index) => (
                                                <li
                                                    key={index}
                                                    className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"
                                                >
                                                    <XCircle className="w-3 h-3 shrink-0" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <p className="text-muted-foreground text-xs">
                                    Your theme colors and basic content will be preserved.
                                </p>
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        {isToAdvanced ? 'Stay in Simple Mode' : 'Keep Advanced Mode'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className={
                            isToAdvanced
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-amber-600 hover:bg-amber-700'
                        }
                    >
                        {isToAdvanced ? (
                            <>
                                <Settings2 className="w-4 h-4 mr-2" />
                                Switch to Advanced
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4 mr-2" />
                                Reset to Simple
                            </>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
