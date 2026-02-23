/**
 * Limit Enforced Button
 * Button that checks tenant limits before allowing action
 */

import { ReactNode } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface LimitEnforcedButtonProps extends ButtonProps {
  resource: 'customers' | 'menus' | 'products' | 'locations' | 'users';
  action: () => void | Promise<void>;
  children: ReactNode;
}

export function LimitEnforcedButton({
  resource,
  action,
  children,
  onClick,
  ...props
}: LimitEnforcedButtonProps) {
  const { canCreate, getCurrent, getLimit } = useTenantLimits();
  const navigate = useNavigate();

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!canCreate(resource)) {
      const current = getCurrent(resource);
      const limit = getLimit(resource);
      
      // Don't show error for unlimited accounts
      if (limit === Infinity) {
        // Unlimited account - allow the action
        if (onClick) {
          onClick(e);
        }
        await action();
        return;
      }
      
      toast.error(`You've reached your ${resource} limit (${current}/${limit === Infinity ? '\u221E' : limit}). Please upgrade your plan.`, {
        action: {
          label: 'Upgrade',
          onClick: () => navigate('/saas/billing'),
        },
      });
      return;
    }

    // Call the provided onClick first, then the action
    if (onClick) {
      onClick(e);
    }
    
    await action();
  };

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  );
}

