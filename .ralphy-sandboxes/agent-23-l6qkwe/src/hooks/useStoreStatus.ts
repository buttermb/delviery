import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export interface DaySchedule {
    isOpen: boolean;
    open: string; // "09:00"
    close: string; // "22:00"
}

export interface OperatingHours {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
}

export function useStoreStatus(storeId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.storeStatus.byStore(storeId),
        queryFn: async () => {
            if (!storeId) return null;

            const { data, error } = await supabase
                .from('marketplace_stores')
                .select('is_active, operating_hours')
                .eq('id', storeId)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!storeId,
        select: (data) => {
            if (!data) return { isOpen: false, reason: 'Store not found' };

            if (!data.is_active) {
                return { isOpen: false, reason: 'Store is currently inactive' };
            }

            const hours = data.operating_hours as unknown as OperatingHours | null;

            // If no hours set, assume open 24/7 (or handled elsewhere)
            if (!hours) return { isOpen: true };

            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDayName = days[now.getDay()];
            const todaySchedule = hours[currentDayName as keyof OperatingHours];

            if (!todaySchedule || !todaySchedule.isOpen) {
                return { isOpen: false, reason: 'Closed today' };
            }

            // Check specific times
            const currentTime = now.getHours() * 60 + now.getMinutes();

            const [openHour, openMinute] = todaySchedule.open.split(':').map(Number);
            const [closeHour, closeMinute] = todaySchedule.close.split(':').map(Number);

            const openTime = openHour * 60 + openMinute;
            const closeTime = closeHour * 60 + closeMinute;

            if (currentTime < openTime || currentTime > closeTime) {
                return {
                    isOpen: false,
                    reason: `Closed now. Open ${todaySchedule.open} - ${todaySchedule.close}`,
                    nextOpen: todaySchedule.open
                };
            }

            return { isOpen: true };
        }
    });
}
