import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';

interface Account {
  id: string;
  company_name: string;
  slug: string;
  status: string;
}

export function AccountSwitcher() {
  const { account, isSuperAdmin, switchAccount } = useAccount();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAccounts();
    }
  }, [isSuperAdmin]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, company_name, slug, status')
        .order('company_name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      logger.error('Error loading accounts', error as Error, 'AccountSwitcher');
    }
  };

  const handleAccountChange = async (accountId: string) => {
    setLoading(true);
    try {
      await switchAccount(accountId);
      toast({
        title: 'Account switched',
        description: 'Viewing data for selected account'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to switch account',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
      <Building className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Viewing:</span>
      <Select
        value={account?.id}
        onValueChange={handleAccountChange}
        disabled={loading}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              <div className="flex items-center gap-2">
                <span>{acc.company_name}</span>
                <span className="text-xs text-muted-foreground">@{acc.slug}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
