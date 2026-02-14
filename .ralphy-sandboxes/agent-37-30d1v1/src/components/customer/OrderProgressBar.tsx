import { Check, Package, ChefHat, Truck, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderProgressBarProps {
    status: string;
}

export function OrderProgressBar({ status }: OrderProgressBarProps) {
    const steps = [
        { id: 'pending', label: 'Placed', icon: Package },
        { id: 'confirmed', label: 'Confirmed', icon: Check },
        { id: 'preparing', label: 'Preparing', icon: ChefHat },
        { id: 'out_for_delivery', label: 'On the Way', icon: Truck },
        { id: 'delivered', label: 'Delivered', icon: Home },
    ];

    const getCurrentStepIndex = (status: string) => {
        const index = steps.findIndex(s => s.id === status);
        if (index === -1) {
            // Handle edge cases or map other statuses
            if (status === 'ready_for_pickup') return 2; // Treat as preparing/ready
            if (status === 'cancelled') return -1;
            return 0;
        }
        return index;
    };

    const currentStepIndex = getCurrentStepIndex(status);

    return (
        <div className="w-full py-6">
            <div className="relative flex items-center justify-between w-full">
                {/* Progress Line Background */}
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-zinc-700 rounded-full -z-10" />

                {/* Active Progress Line */}
                <div
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-primary rounded-full -z-10 transition-all duration-1000 ease-in-out"
                    style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                        <div key={step.id} className="flex flex-col items-center gap-2 bg-white dark:bg-zinc-900 px-2">
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                                    isActive
                                        ? "bg-primary border-primary text-white shadow-lg scale-110"
                                        : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-400 dark:text-zinc-500"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                            <span
                                className={cn(
                                    "text-xs font-medium transition-colors duration-300",
                                    isActive ? "text-primary" : "text-gray-400 dark:text-zinc-500",
                                    isCurrent && "font-bold scale-105"
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
