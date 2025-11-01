/**
 * Limit Enforced Button
 * Button that checks tenant limits before allowing action
 */

import { ReactNode } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!canCreate(resource)) {
      const current = getCurrent(resource);
      const limit = getLimit(resource);
      
      toast({
        title: 'Limit Reached',
        description: `You've reached your ${resource} limit (${current}/${limit}). Please upgrade your plan.`,
        variant: 'destructive',
        action: (
          <Button
            size="sm"
            onClick={() => navigate('/saas/billing')}
          >
            Upgrade
          </Button>
        ),
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

