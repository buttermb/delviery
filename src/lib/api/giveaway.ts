import { supabase } from '@/integrations/supabase/client';

// ============================================
// GET GIVEAWAY
// ============================================
export async function getGiveaway(slug: string) {
  const { data, error } = await supabase
    .from('giveaways')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error) {
    console.error('Error:', error);
    return null;
  }

  return data;
}

// ============================================
// SUBMIT ENTRY
// ============================================
export async function submitGiveawayEntry(
  giveawayId: string,
  entryData: {
    email?: string;
    password?: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    borough: string;
    instagramHandle: string;
    instagramTagUrl: string;
    newsletterSubscribe: boolean;
    newsletterOptIn?: boolean;
    referralCode?: string;
  }
) {
  try {
    // 1. Get device fingerprint
    const { getDeviceFingerprint } = await import('@/utils/deviceFingerprint');
    const deviceFingerprint = await getDeviceFingerprint();

    // 2. Get giveaway config
    const { data: giveaway } = await supabase
      .from('giveaways')
      .select('*')
      .eq('id', giveawayId)
      .single();

    if (!giveaway) throw new Error('Giveaway not found');

    // 3. Validate email using Supabase functions
    const { data: emailResult, error: emailError } = await supabase.functions.invoke('validate-email', {
      body: { email: entryData.email }
    });
    
    if (emailError) {
      throw new Error('Email validation failed');
    }
    
    if (!emailResult?.valid) {
      throw new Error(emailResult?.reason || 'Invalid email address');
    }

    // 4. Validate phone using Supabase functions
    const { data: phoneResult, error: phoneError } = await supabase.functions.invoke('validate-phone', {
      body: { phone: entryData.phone }
    });
    
    if (phoneError) {
      throw new Error('Phone validation failed');
    }
    
    if (!phoneResult?.valid) {
      throw new Error(phoneResult?.reason || 'Invalid phone number');
    }

    // 5. Check for duplicate entries
    const { data: existingEntry } = await supabase
      .from('giveaway_entries')
      .select('id')
      .eq('giveaway_id', giveawayId)
      .or(`user_email.eq.${entryData.email},user_phone.eq.${phoneResult.cleanPhone},device_fingerprint.eq.${deviceFingerprint}`)
      .single();

    if (existingEntry) {
      throw new Error('You have already entered this giveaway');
    }

    // 6. Calculate fraud score
    const { data: fraudScore } = await supabase.rpc('calculate_fraud_score', {
      p_email: entryData.email || '',
      p_phone: phoneResult.cleanPhone,
      p_device_fingerprint: deviceFingerprint,
      p_ip_address: 'unknown'
    });

    if (fraudScore && fraudScore > 70) {
      // Log failed attempt
      await supabase.from('giveaway_failed_attempts').insert({
        email: entryData.email,
        phone: phoneResult.cleanPhone,
        device_fingerprint: deviceFingerprint,
        error_message: 'High fraud score',
        error_type: 'fraud_detected'
      });
      throw new Error('Entry could not be processed. Please contact support.');
    }

    // 7. Check if user is already logged in
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    let userId: string;

    if (currentUser) {
      // User is already logged in
      userId = currentUser.id;
    } else {
      // Create new user account
      if (!entryData.email || !entryData.password) {
        throw new Error('Email and password are required for new accounts');
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: entryData.email,
        password: entryData.password,
        options: {
          data: {
            first_name: entryData.firstName,
            last_name: entryData.lastName,
            phone: phoneResult.cleanPhone,
            date_of_birth: entryData.dateOfBirth,
            borough: entryData.borough,
            instagram_handle: entryData.instagramHandle
          },
          emailRedirectTo: `${window.location.origin}/giveaway/nyc-biggest-flower`
        }
      });

      if (authError) {
        if (authError.message?.includes('already registered')) {
          throw new Error('This email is already registered. Please log in first to enter the giveaway.');
        }
        throw authError;
      }
      
      userId = authData.user?.id;
      if (!userId) throw new Error('Failed to create user');
    }

    // 8. Calculate entry numbers
    const { data: lastEntry } = await supabase
      .from('giveaway_entries')
      .select('entry_number_end')
      .eq('giveaway_id', giveawayId)
      .order('entry_number_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    const entryNumberStart = (lastEntry?.entry_number_end || 0) + 1;

    // 9. Calculate bonus entries
    const baseEntries = giveaway.base_entries || 1;
    const newsletterEntries = (entryData.newsletterSubscribe || entryData.newsletterOptIn) 
      ? (giveaway.newsletter_bonus_entries || 1) 
      : 0;
    const referralEntries = entryData.referralCode ? (giveaway.referral_bonus_entries || 3) : 0;
    const totalEntries = baseEntries + newsletterEntries + referralEntries;
    const entryNumberEnd = entryNumberStart + totalEntries - 1;

    // 10. Create entry (unverified)
    const { data: entry, error: entryError } = await supabase
      .from('giveaway_entries')
      .insert({
        giveaway_id: giveawayId,
        user_id: userId,
        user_email: entryData.email,
        user_first_name: entryData.firstName,
        user_last_name: entryData.lastName,
        user_phone: phoneResult.cleanPhone,
        user_borough: entryData.borough,
        instagram_handle: entryData.instagramHandle,
        instagram_tag_url: entryData.instagramTagUrl,
        base_entries: baseEntries,
        newsletter_entries: newsletterEntries,
        referral_entries: referralEntries,
        total_entries: totalEntries,
        entry_number_start: entryNumberStart,
        entry_number_end: entryNumberEnd,
        device_fingerprint: deviceFingerprint,
        fraud_score: fraudScore || 0,
        status: 'pending'
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // 11. Send OTP codes
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          entryId: entry.id,
          email: entryData.email,
          phone: phoneResult.cleanPhone
        })
      }
    );

    return {
      success: true,
      requiresVerification: true,
      entryId: entry.id,
      userId,
      email: entryData.email,
      phone: phoneResult.formatted,
      totalEntries,
      entryNumbers: {
        start: entryNumberStart,
        end: entryNumberEnd
      },
      breakdown: {
        base: baseEntries,
        newsletter: newsletterEntries,
        referrals: referralEntries
      }
    };

  } catch (error) {
    console.error('Error submitting entry:', error);
    throw error;
  }
}

// ============================================
// GET USER ENTRY
// ============================================
export async function getUserEntry(giveawayId: string, userId: string) {
  const { data: entry, error } = await supabase
    .from('giveaway_entries')
    .select('*')
    .eq('giveaway_id', giveawayId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !entry) return null;

  const { data: referrals } = await supabase
    .from('giveaway_referrals')
    .select('*')
    .eq('giveaway_id', giveawayId)
    .eq('referrer_user_id', userId);

  const referralLink = `${window.location.origin}/giveaway/nyc-biggest-flower?ref=${userId}`;

  return {
    entryId: entry.id,
    totalEntries: entry.total_entries,
    breakdown: {
      base: entry.base_entries,
      newsletter: entry.newsletter_entries,
      referrals: entry.referral_entries
    },
    referralStats: {
      successfulReferrals: referrals?.filter(r => r.converted).length || 0,
      totalBonusEntries: entry.referral_entries
    },
    referralLink,
    status: entry.status,
    entryNumbers: {
      start: entry.entry_number_start,
      end: entry.entry_number_end
    }
  };
}

// ============================================
// GET ALL USER ENTRIES
// ============================================
export async function getAllUserEntries(userId: string) {
  const { data: entries, error } = await supabase
    .from('giveaway_entries')
    .select(`
      id,
      giveaway_id,
      entry_type,
      total_entries,
      entry_number_start,
      entry_number_end,
      status,
      entered_at,
      verified_at,
      order_id,
      giveaways (
        title,
        slug
      )
    `)
    .eq('user_id', userId)
    .order('entered_at', { ascending: false });

  if (error) {
    console.error('Error fetching entries:', error);
    return [];
  }

  return entries;
}

// ============================================
// GET USER GIVEAWAY SUMMARY
// ============================================
export async function getUserGiveawaySummary(userId: string) {
  const { data: entries } = await supabase
    .from('giveaway_entries')
    .select('total_entries, entry_type, status, giveaway_id')
    .eq('user_id', userId);

  if (!entries) return null;

  const giveawayIds = new Set(entries.map(e => e.giveaway_id));

  return {
    totalEntries: entries.reduce((sum, e) => sum + (e.total_entries || 0), 0),
    verifiedEntries: entries.filter(e => e.status === 'verified').reduce((sum, e) => sum + (e.total_entries || 0), 0),
    manualEntries: entries.filter(e => e.entry_type === 'manual').length,
    purchaseEntries: entries.filter(e => e.entry_type === 'purchase').length,
    totalGiveaways: giveawayIds.size
  };
}

// ============================================
// GET RECENT ENTRIES
// ============================================
export async function getRecentEntries(giveawayId: string, limit = 10) {
  const { data, error } = await supabase
    .from('giveaway_entries')
    .select('user_first_name, user_last_name, user_borough, total_entries, entered_at')
    .eq('giveaway_id', giveawayId)
    .order('entered_at', { ascending: false })
    .limit(limit);

  if (error) return [];

  return data.map(entry => ({
    name: `${entry.user_first_name} ${entry.user_last_name?.charAt(0)}.`,
    borough: entry.user_borough,
    entries: entry.total_entries,
    timestamp: formatTimeAgo(entry.entered_at)
  }));
}

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 120) return '1 minute ago';
  if (seconds < 300) return 'a few minutes ago';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours} hours ago`;
}

// ============================================
// CLAIM BONUS ENTRY
// ============================================
export async function claimBonusEntry(
  giveawayId: string,
  bonusType: 'instagram_story' | 'instagram_post',
  proofUrl: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get giveaway config
    const { data: giveaway } = await supabase
      .from('giveaways')
      .select('instagram_story_bonus_entries, instagram_post_bonus_entries')
      .eq('id', giveawayId)
      .single();

    if (!giveaway) throw new Error('Giveaway not found');

    // Get current entry
    const { data: currentEntry, error: fetchError } = await supabase
      .from('giveaway_entries')
      .select('*')
      .eq('giveaway_id', giveawayId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) throw fetchError;

    // Calculate bonus entries
    const bonusEntries = bonusType === 'instagram_story' 
      ? giveaway.instagram_story_bonus_entries
      : giveaway.instagram_post_bonus_entries;

    // Check if already claimed
    if (bonusType === 'instagram_story' && currentEntry.instagram_story_entries > 0) {
      throw new Error('Story bonus already claimed');
    }
    if (bonusType === 'instagram_post' && currentEntry.instagram_post_entries > 0) {
      throw new Error('Post bonus already claimed');
    }

    // Update entry with bonus
    const updates: any = {
      total_entries: currentEntry.total_entries + bonusEntries,
      entry_number_end: currentEntry.entry_number_end + bonusEntries
    };

    if (bonusType === 'instagram_story') {
      updates.instagram_story_entries = bonusEntries;
      updates.instagram_story_shared = true;
      updates.story_url = proofUrl;
    } else {
      updates.instagram_post_entries = bonusEntries;
      updates.instagram_post_shared = true;
      updates.post_url = proofUrl;
    }

    const { error: updateError } = await supabase
      .from('giveaway_entries')
      .update(updates)
      .eq('id', currentEntry.id);

    if (updateError) throw updateError;

    return {
      success: true,
      bonusEntries,
      newTotal: updates.total_entries
    };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to claim bonus');
  }
}
