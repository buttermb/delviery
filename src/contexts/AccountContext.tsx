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
  branding: any;
  compliance_settings: any;
  notification_settings: any;
  integration_settings: any;
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
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      if (profile && (profile as any).account_id) {
        // Get user role from user_roles table (secure)
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role, account_id')
          .eq('user_id', userId)
          .single() as any;

        const role = roleData?.role || 'customer';
        const accountId = (profile as any).account_id || roleData?.account_id;

        setUserProfile({
          id: profile.id,
          user_id: profile.user_id,
          account_id: accountId,
          role: role as any,
          full_name: profile.full_name,
          email: (profile as any).email || null
        });

        if (accountId) {
          // Get account separately
          const { data: accountData } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

          if (accountData) {
            setAccount(accountData as Account);

            // Get account settings
            const { data: settings } = await supabase
              .from('account_settings')
              .select('*')
              .eq('account_id', accountId)
              .single();

            if (settings) {
              setAccountSettings(settings as AccountSettings);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading account data:', error);
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
      console.error('Only super admins can switch accounts');
      return;
    }

    try {
      setLoading(true);

      const { data: targetAccount } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (targetAccount) {
        setAccount(targetAccount as Account);

        const { data: settings } = await supabase
          .from('account_settings')
          .select('*')
          .eq('account_id', accountId)
          .single();

        if (settings) {
          setAccountSettings(settings as AccountSettings);
        }
      }
    } catch (error) {
      console.error('Error switching account:', error);
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
