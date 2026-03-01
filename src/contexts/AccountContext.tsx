import { logger } from '@/lib/logger';
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface Account {
  id: string;
  company_name: string;
  slug: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  billing_email: string | null;
  created_at: string;
}

interface AccountSettings {
  id: string;
  account_id: string;
  business_license: string | null;
  tax_rate: number;
  state: string | null;
  operating_states: string[];
  branding: Record<string, unknown> | null;
  compliance_settings: Record<string, unknown> | null;
  notification_settings: Record<string, unknown> | null;
  integration_settings: Record<string, unknown> | null;
}

interface UserProfile {
  id: string;
  user_id: string;
  account_id: string;
  role: 'super_admin' | 'account_owner' | 'account_admin' | 'team_member' | 'courier' | 'customer';
  full_name: string | null;
  email: string | null;
}

interface AccountContextType {
  account: Account | null;
  accountSettings: AccountSettings | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAccountOwner: boolean;
  isAccountAdmin: boolean;
  refreshAccount: () => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountSettings, setAccountSettings] = useState<AccountSettings | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAccountOwner = userProfile?.role === 'account_owner';
  const isAccountAdmin = userProfile?.role === 'account_admin' || isAccountOwner;

  const loadAccountData = async (userId: string) => {
    try {
      // Get user profile first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, account_id, full_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.account_id) {
        // Fallback to user_roles table for role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        const role = roleData?.role || 'customer';
        const accountId = profile.account_id;

        setUserProfile({
          id: profile.id,
          user_id: profile.user_id,
          account_id: accountId,
          role: role as UserProfile['role'],
          full_name: profile.full_name,
          email: null
        });

        if (accountId) {
          // Get account separately
          const { data: accountData } = await supabase
            .from('accounts')
            .select('id, company_name, slug, plan_id, status, trial_ends_at, billing_email, created_at')
            .eq('id', accountId)
            .maybeSingle();

          if (accountData) {
            setAccount(accountData as Account);

            // Get account settings
            const { data: settings } = await supabase
              .from('account_settings')
              .select('id, account_id, business_license, tax_rate, state, operating_states, branding, compliance_settings, notification_settings, integration_settings')
              .eq('account_id', accountId)
              .maybeSingle();

            if (settings) {
              setAccountSettings(settings as AccountSettings);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error loading account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAccount = async () => {
    if (user) {
      setLoading(true);
      await loadAccountData(user.id);
    }
  };

  const switchAccount = async (accountId: string) => {
    if (!isSuperAdmin) {
      logger.error('Only super admins can switch accounts');
      return;
    }

    try {
      setLoading(true);

      const { data: targetAccount } = await supabase
        .from('accounts')
        .select('id, company_name, slug, plan_id, status, trial_ends_at, billing_email, created_at')
        .eq('id', accountId)
        .maybeSingle();

      if (targetAccount) {
        setAccount(targetAccount as Account);

        const { data: settings } = await supabase
          .from('account_settings')
          .select('id, account_id, business_license, tax_rate, state, operating_states, branding, compliance_settings, notification_settings, integration_settings')
          .eq('account_id', accountId)
          .maybeSingle();

        if (settings) {
          setAccountSettings(settings as AccountSettings);
        }
      }
    } catch (error) {
      logger.error('Error switching account:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAccountData(user.id);
    } else {
      setAccount(null);
      setAccountSettings(null);
      setUserProfile(null);
      setLoading(false);
    }
  }, [user]);

  return (
    <AccountContext.Provider
      value={{
        account,
        accountSettings,
        userProfile,
        loading,
        isSuperAdmin,
        isAccountOwner,
        isAccountAdmin,
        refreshAccount,
        switchAccount
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
};
