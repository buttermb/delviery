import { useState, useEffect } from 'react';
import { submitGiveawayEntry } from '@/lib/api/giveaway';
import { supabase } from '@/integrations/supabase/client';
import { Instagram, Loader2, Sparkles, Check, Mail, Users, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import SimpleDatePicker from './SimpleDatePicker';
import VerificationStep from './VerificationStep';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Giveaway {
  id: string;
  [key: string]: unknown;
}

interface EntryResult {
  entry_id?: string;
  [key: string]: unknown;
}

interface EntryFormProps {
  giveaway: Giveaway;
  referralCode?: string;
  onSuccess: () => void;
}

export default function EntryForm({ giveaway, referralCode, onSuccess }: EntryFormProps) {
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [entryResult, setEntryResult] = useState<EntryResult | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  
  // Auto-save form data locally
  const [savedDraft, setSavedDraft] = useLocalStorage('giveaway-draft', null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    dateOfBirth: null as Date | null,
    borough: '',
    instagramHandle: '',
    instagramTagUrl: '',
    newsletterSubscribe: true
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      
      // Pre-fill email for logged-in users
      if (user?.email) {
        setFormData(prev => ({
          ...prev,
          email: user.email || ''
        }));
      }
    });
    
    // Restore draft if exists
    if (savedDraft && typeof savedDraft === 'object') {
      setFormData(prev => ({
        ...prev,
        ...savedDraft,
        dateOfBirth: savedDraft.dateOfBirth ? new Date(savedDraft.dateOfBirth) : null
      }));
      toast({
        title: "Draft Restored",
        description: "We recovered your previous entry attempt"
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Save draft locally
    setSavedDraft(formData);

    try {
      const result = await submitGiveawayEntry(giveaway.id, {
        ...formData,
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth.toISOString().split('T')[0] : '',
        referralCode
      });

      setEntryResult(result);
      
      if (result.requiresVerification) {
        setShowVerification(true);
      } else {
        // Clear draft on success
        setSavedDraft(null);
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#10b981', '#3b82f6', '#8b5cf6']
        });
        setShowSuccess(true);
        setTimeout(() => onSuccess(), 5000);
      }

    } catch (error: any) {
      console.error('Submission error:', error);
      setError(error.message || "Failed to submit entry");
      
      // Auto-retry on network errors
      if (
        retryCount < 3 && 
        (error.message?.includes('Network') || 
         error.message?.includes('timeout') ||
         error.message?.includes('connection'))
      ) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          handleSubmit(e);
        }, 2000 * (retryCount + 1)); // Exponential backoff
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to submit entry",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (showVerification && entryResult) {
    return (
      <VerificationStep
        entryId={entryResult.entryId}
        email={entryResult.email}
        phone={entryResult.phone}
        onSuccess={(entry) => {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#10b981', '#3b82f6', '#8b5cf6']
          });
          setEntryResult({ ...entryResult, ...entry });
          setShowVerification(false);
          setShowSuccess(true);
          setTimeout(() => onSuccess(), 5000);
        }}
      />
    );
  }

  if (showSuccess && entryResult) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto mb-20"
      >
        <div className="relative bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-12 text-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-40 bg-gradient-to-b from-primary/20 to-transparent blur-3xl" />
          
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 bg-gradient-to-br from-primary to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl"
            >
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </motion.div>

            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-3 text-white">
              You're Entered!
            </h2>
            <p className="text-slate-400 mb-10 font-light">
              Entry #{entryResult.entryNumbers.start.toLocaleString()}
            </p>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 150 }}
                className="text-6xl sm:text-7xl font-display font-bold bg-gradient-to-br from-primary to-blue-400 text-transparent bg-clip-text mb-3"
              >
                {entryResult.totalEntries}
              </motion.div>
              <div className="text-slate-500 font-medium uppercase tracking-wider text-sm">Your Total Entries</div>
            </div>

            <div className="space-y-3 max-w-md mx-auto mb-8">
              <div className="flex justify-between items-center px-4 py-3 bg-slate-800/30 rounded-xl">
                <span className="text-slate-400 text-sm">Base entry</span>
                <span className="font-bold text-white">{entryResult.breakdown.base}</span>
              </div>
              {entryResult.breakdown.newsletter > 0 && (
                <div className="flex justify-between items-center px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
                  <span className="text-slate-400 text-sm">Newsletter bonus</span>
                  <span className="font-bold text-primary">+{entryResult.breakdown.newsletter}</span>
                </div>
              )}
            </div>

            {/* Welcome Discount Section */}
            <div className="mt-8 p-6 bg-gradient-to-r from-primary/20 to-blue-500/20 border border-primary/30 rounded-2xl">
              <h3 className="text-xl font-bold mb-2 text-white">Welcome Gift 🎁</h3>
              <p className="text-sm text-slate-300 mb-4">
                Thanks for entering! Here's 10% off your first order:
              </p>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-black text-primary">WELCOME10</div>
                  <div className="text-xs text-slate-400">Valid for 30 days</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('WELCOME10');
                    toast({ title: "Code copied!" });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <a
                href="/"
                className="block mt-4 text-center py-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-all text-white font-medium"
              >
                Start Shopping →
              </a>
            </div>

            <p className="text-slate-500 text-sm font-light mt-6">
              Check your email for next steps • Redirecting in 5 seconds...
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto mb-20"
    >
      <div className="relative bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl">
        {/* Error Banner */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {retryCount > 0 && (
                <span className="block text-sm mt-1">
                  Retry attempt {retryCount} of 3...
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {!isLoggedIn && (
          <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2 bg-blue-500/10 border border-blue-400/20 rounded-full w-fit mx-auto">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Account Required to Enter</span>
          </div>
        )}

        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-3 bg-gradient-to-br from-white to-slate-400 text-transparent bg-clip-text">
            {isLoggedIn ? 'Enter Giveaway' : 'Create Account & Enter'}
          </h2>
          <p className="text-slate-500 font-light">
            {isLoggedIn ? 'Complete your entry below • 100% FREE' : 'Takes 2 minutes • 100% FREE • Instant Entry'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First Name"
              className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500 text-white font-light"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Last Name"
              className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500 text-white font-light"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>

          {!isLoggedIn && (
            <>
              <input
                type="email"
                placeholder="Email Address"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500 text-white font-light"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
              />

              <input
                type="password"
                placeholder="Create Password (minimum 8 characters)"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500 text-white font-light"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </>
          )}

          <input
            type="tel"
            placeholder="Phone Number (for prize delivery)"
            className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500 text-white font-light"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />

          <SimpleDatePicker
            value={formData.dateOfBirth}
            onChange={(date) => setFormData({ ...formData, dateOfBirth: date })}
          />

          <select
            className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer text-white font-light"
            value={formData.borough}
            onChange={(e) => setFormData({ ...formData, borough: e.target.value })}
            required
          >
            <option value="" className="bg-slate-900">Select NYC Borough</option>
            <option value="Manhattan" className="bg-slate-900">Manhattan</option>
            <option value="Brooklyn" className="bg-slate-900">Brooklyn</option>
            <option value="Queens" className="bg-slate-900">Queens</option>
            <option value="Bronx" className="bg-slate-900">Bronx</option>
            <option value="Staten Island" className="bg-slate-900">Staten Island</option>
          </select>

          {/* Instagram Section */}
          <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Instagram className="w-5 h-5 text-pink-400" />
              <h3 className="font-display font-bold text-pink-400">Instagram (Required)</h3>
              <span className="ml-auto text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-full border border-red-500/20 font-medium">
                Required
              </span>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="@your_instagram_handle"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 transition-all placeholder:text-slate-500 text-white font-light"
                value={formData.instagramHandle}
                onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                required
              />

              <input
                type="url"
                placeholder="Instagram post URL (where you tagged us)"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 transition-all placeholder:text-slate-500 text-white font-light"
                value={formData.instagramTagUrl}
                onChange={(e) => setFormData({ ...formData, instagramTagUrl: e.target.value })}
                required
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 font-light">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" /> Follow on Instagram
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" /> Tag 2+ friends
              </span>
            </div>
          </div>

          {/* Newsletter Checkbox */}
          <motion.label
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="flex items-center gap-4 cursor-pointer p-5 bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20 rounded-xl hover:border-primary/40 transition-all group"
          >
            <input
              type="checkbox"
              checked={formData.newsletterSubscribe}
              onChange={(e) => setFormData({ ...formData, newsletterSubscribe: e.target.checked })}
              className="w-5 h-5 rounded-lg border-2 border-slate-600 bg-slate-800 checked:bg-primary checked:border-primary cursor-pointer transition-all"
            />
            <div className="flex-1 flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <span className="text-white font-medium">
                Subscribe to newsletter
              </span>
              <span className="ml-auto text-primary font-bold text-sm">+1 entry</span>
            </div>
          </motion.label>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden py-4 rounded-xl font-display font-bold text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-emerald-500 to-blue-500 group-hover:from-primary/90 group-hover:via-emerald-500/90 group-hover:to-blue-500/90 transition-all" />
            <span className="relative flex items-center justify-center gap-2 text-white">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting Entry...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Enter Giveaway FREE
                  <Sparkles className="w-5 h-5" />
                </>
              )}
            </span>
          </motion.button>

          <p className="text-xs text-slate-500 text-center font-light leading-relaxed">
            By entering, you agree to our terms and conditions.<br />
            Must be 21+ years old and located in NYC area.
          </p>
        </form>
      </div>
    </motion.div>
  );
}
