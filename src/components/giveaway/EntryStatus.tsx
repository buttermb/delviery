import { Check, Copy, Share2, Instagram, MessageCircle, Camera, Image, QrCode } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { claimBonusEntry } from '@/lib/api/giveaway';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  FacebookShareButton,
  TwitterShareButton,
  WhatsappShareButton,
  FacebookIcon,
  TwitterIcon,
  WhatsappIcon,
} from 'react-share';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface EntryStatusProps {
  entry: any;
  giveaway: any;
  onUpdate: () => void;
}

export default function EntryStatus({ entry, giveaway, onUpdate }: EntryStatusProps) {
  const [copied, setCopied] = useState(false);
  const [claimingStory, setClaimingStory] = useState(false);
  const [claimingPost, setClaimingPost] = useState(false);
  const [storyUrl, setStoryUrl] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [showQR, setShowQR] = useState(false);

  const shareText = `🎉 Join me in Bud Dash NYC's giveaway! Win premium flower and more! ${entry.referralLink}`;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(entry.referralLink);
    setCopied(true);
    toast.success('Referral link copied to clipboard!');
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: giveaway.title,
          text: `🎉 Join me in winning ${giveaway.grand_prize_title}! Enter BudDash NYC's giveaway now!`,
          url: entry.referralLink
        });
        toast.success('Thanks for sharing!');
      } catch (err) {
        // User cancelled or error occurred
        console.log('Share cancelled or failed');
      }
    } else {
      copyReferralLink();
    }
  };

  const handleClaimStoryBonus = async () => {
    if (!storyUrl) {
      toast.error('Please enter your Instagram story URL');
      return;
    }
    
    setClaimingStory(true);
    try {
      await claimBonusEntry(giveaway.id, 'instagram_story', storyUrl);
      toast.success(`+${giveaway.instagram_story_bonus_entries} bonus entries added!`);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setClaimingStory(false);
    }
  };

  const handleClaimPostBonus = async () => {
    if (!postUrl) {
      toast.error('Please enter your Instagram post URL');
      return;
    }
    
    setClaimingPost(true);
    try {
      await claimBonusEntry(giveaway.id, 'instagram_post', postUrl);
      toast.success(`+${giveaway.instagram_post_bonus_entries} bonus entries added!`);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setClaimingPost(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mb-20">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl overflow-hidden"
      >
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-primary/20 to-transparent blur-3xl" />

        <div className="relative text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-16 h-16 bg-gradient-to-br from-primary to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
          >
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-2 text-white">
            You're Entered!
          </h2>
          <p className="text-slate-500 font-light text-sm">
            Entry #{entry.entryId?.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Entry summary */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
            className="text-center mb-6"
          >
            <div className="text-6xl sm:text-7xl font-display font-bold bg-gradient-to-br from-primary via-emerald-400 to-blue-400 text-transparent bg-clip-text mb-2">
              {entry.totalEntries}
            </div>
            <div className="text-slate-500 font-medium uppercase tracking-wider text-sm">Total Entries</div>
          </motion.div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-4 py-3 bg-slate-700/30 rounded-xl">
              <span className="text-slate-400 text-sm">Base entry</span>
              <span className="font-bold text-white">{entry.breakdown.base}</span>
            </div>
            {entry.breakdown.newsletter > 0 && (
              <div className="flex justify-between items-center px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
                <span className="text-slate-400 text-sm">Newsletter bonus</span>
                <span className="font-bold text-primary">+{entry.breakdown.newsletter}</span>
              </div>
            )}
            {entry.breakdown.referrals > 0 && (
              <div className="flex justify-between items-center px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <span className="text-slate-400 text-sm">Referral bonus</span>
                <span className="font-bold text-blue-400">+{entry.breakdown.referrals}</span>
              </div>
            )}
          </div>
        </div>

        {/* Referral section */}
        <div className="relative bg-gradient-to-br from-primary/10 to-blue-500/10 border border-primary/20 rounded-2xl p-6 mb-6">
          <div className="mb-5">
            <h3 className="font-display font-bold text-xl mb-2 flex items-center gap-2 text-white">
              <Share2 className="w-5 h-5 text-primary" />
              Refer Friends
            </h3>
            <p className="text-slate-400 text-sm font-light">
              Earn <span className="text-primary font-semibold">+3 entries</span> for each friend who signs up • Unlimited
            </p>
          </div>

          {/* Referral link */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={entry.referralLink}
              readOnly
              className="flex-1 bg-slate-800/70 backdrop-blur-sm px-4 py-3 rounded-xl text-sm border border-slate-700 focus:border-primary focus:outline-none transition-all text-slate-300 font-mono"
              onClick={(e) => e.currentTarget.select()}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={copyReferralLink}
              className="bg-slate-800/70 hover:bg-slate-700/70 px-5 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-700 hover:border-primary/50 transition-all text-white"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-primary">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </motion.button>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 py-3 rounded-xl font-bold text-sm transition-all text-white shadow-lg"
            >
              <Share2 className="w-4 h-4" />
              Share Link
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                copyReferralLink();
                setTimeout(() => {
                  window.open('https://www.instagram.com/', '_blank');
                }, 300);
              }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 py-3 rounded-xl font-bold text-sm transition-all text-white shadow-lg"
            >
              <Instagram className="w-4 h-4" />
              Instagram
            </motion.button>
          </div>

          {/* Social share buttons */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <FacebookShareButton url={entry.referralLink} hashtag="#BudDashNYC">
              <FacebookIcon size={40} round />
            </FacebookShareButton>
            <TwitterShareButton url={entry.referralLink} title={shareText}>
              <TwitterIcon size={40} round />
            </TwitterShareButton>
            <WhatsappShareButton url={entry.referralLink} title={shareText}>
              <WhatsappIcon size={40} round />
            </WhatsappShareButton>
          </div>

          {/* QR Code */}
          <Dialog open={showQR} onOpenChange={setShowQR}>
            <DialogTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 bg-slate-800/70 hover:bg-slate-700/70 py-3 rounded-xl font-bold text-sm border border-slate-700 hover:border-primary/50 transition-all text-white"
              >
                <QrCode className="w-4 h-4" />
                Show QR Code
              </motion.button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">Share QR Code</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="p-6 bg-white rounded-2xl shadow-xl">
                  <QRCodeSVG
                    value={entry.referralLink}
                    size={200}
                    level="H"
                    includeMargin
                    fgColor="#10b981"
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Scan to enter the giveaway
                </p>
              </div>
            </DialogContent>
          </Dialog>

          {/* Referral stats */}
          {entry.referralStats.successfulReferrals > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 p-4 bg-slate-800/50 border border-slate-700 rounded-xl"
            >
              <div className="text-sm text-slate-400 font-light text-center">
                You've referred <span className="text-primary font-bold">{entry.referralStats.successfulReferrals} {entry.referralStats.successfulReferrals === 1 ? 'friend' : 'friends'}</span>
                {' • '}
                <span className="text-blue-400 font-bold">+{entry.referralStats.totalBonusEntries} bonus entries</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Motivation banner */}
        <div className="text-center p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl mb-6">
          <p className="text-sm text-slate-300 font-light">
            Keep sharing to maximize your chances of winning! 🚀
          </p>
        </div>

        {/* Bonus Entry Claims */}
        <div className="space-y-4">
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-400" />
            Earn More Entries
          </h3>

          {/* Instagram Story Bonus */}
          {entry.breakdown.story === 0 && (
            <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-pink-400" />
                <span className="font-semibold text-pink-400">Instagram Story</span>
                <span className="ml-auto text-pink-400 font-bold text-sm">+{giveaway.instagram_story_bonus_entries} entries</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Share about the giveaway on your story</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste your story URL here"
                  value={storyUrl}
                  onChange={(e) => setStoryUrl(e.target.value)}
                  className="flex-1 bg-slate-800/50 border-slate-700 focus:border-pink-400"
                />
                <Button
                  onClick={handleClaimStoryBonus}
                  disabled={claimingStory || !storyUrl}
                  className="bg-gradient-to-r from-pink-500 to-purple-500"
                >
                  {claimingStory ? 'Claiming...' : 'Claim'}
                </Button>
              </div>
            </div>
          )}

          {/* Instagram Post Bonus */}
          {entry.breakdown.post === 0 && (
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Image className="w-5 h-5 text-purple-400" />
                <span className="font-semibold text-purple-400">Instagram Post</span>
                <span className="ml-auto text-purple-400 font-bold text-sm">+{giveaway.instagram_post_bonus_entries} entries</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Create a post about the giveaway</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste your post URL here"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="flex-1 bg-slate-800/50 border-slate-700 focus:border-purple-400"
                />
                <Button
                  onClick={handleClaimPostBonus}
                  disabled={claimingPost || !postUrl}
                  className="bg-gradient-to-r from-purple-500 to-blue-500"
                >
                  {claimingPost ? 'Claiming...' : 'Claim'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
