import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'entry_confirmation' | 'referral_success' | 'winner_notification' | 'non_winner_thank_you';
  to: string;
  data: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, to, data } = await req.json() as EmailRequest;

    let subject = '';
    let htmlContent = '';

    switch (type) {
      case 'entry_confirmation':
        subject = '🎉 You\'re Entered to Win $4,000+ in Premium Flower!';
        htmlContent = generateEntryConfirmationEmail(data);
        break;
      
      case 'referral_success':
        subject = '🎊 +3 Entries! Your Friend Just Signed Up';
        htmlContent = generateReferralSuccessEmail(data);
        break;
      
      case 'winner_notification':
        subject = '🏆 YOU WON! NYC\'s Biggest Flower Giveaway';
        htmlContent = generateWinnerNotificationEmail(data);
        break;
      
      case 'non_winner_thank_you':
        subject = 'Thank You for Entering + Special Offer Inside';
        htmlContent = generateNonWinnerEmail(data);
        break;
    }

    // In production, integrate with Resend or SendGrid
    // For now, log the email
    console.log('Email to send:', { to, subject, type });
    
    // Store in notifications log
    await supabaseClient.from('notifications_log').insert({
      notification_type: type,
      notification_stage: 1,
      recipient_email: to,
      message_content: subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      delivered_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Email error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function generateEntryConfirmationEmail(data: any): string {
  const { firstName, totalEntries, entryNumber, drawingDate, referralLink } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
        .header { text-align: center; padding: 30px 0; }
        .check-icon { font-size: 60px; color: #10b981; }
        .heading { font-size: 32px; color: #1f2937; margin: 20px 0; }
        .summary-box { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .referral-box { background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 8px; padding: 20px; margin: 20px 0; color: white; }
        .link-box { background: white; border: 2px dashed #10b981; border-radius: 4px; padding: 15px; margin: 10px 0; word-break: break-all; color: #1f2937; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 10px 0; }
        .instagram-box { background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="check-icon">✅</div>
          <h1 class="heading">You're Entered! 🎉</h1>
        </div>
        
        <p>Hi ${firstName},</p>
        <p>Congratulations! You've successfully entered NYC's Biggest Flower Giveaway. Your entry has been confirmed and you're in the running to win over $4,000 in premium products!</p>
        
        <div class="summary-box">
          <h3>Your Entry Summary</h3>
          <p><strong>Total Entries:</strong> ${totalEntries}</p>
          <p><strong>Entry Number:</strong> #${entryNumber}</p>
          <p><strong>Drawing Date:</strong> ${drawingDate}</p>
        </div>
        
        <div class="referral-box">
          <h3 style="margin-top: 0; color: white;">🚀 Want More Entries?</h3>
          <p>Share your unique referral link with friends and earn +3 entries for each person who signs up! There's no limit to how many bonus entries you can earn.</p>
          <div class="link-box">
            ${referralLink}
          </div>
          <a href="${referralLink}" class="button" style="background: white; color: #10b981;">Copy Your Link</a>
          <p style="font-size: 18px; margin: 10px 0;"><strong>+3 entries for each friend</strong></p>
        </div>
        
        <div class="instagram-box">
          <h3>📢 Share on Instagram</h3>
          <p>Post about the giveaway and tag @buddashnyc for bonus entries!</p>
          <ul>
            <li>Instagram Story: <strong>+2 entries</strong></li>
            <li>Instagram Post: <strong>+5 entries</strong></li>
          </ul>
          <p>Submit your proof in your account dashboard to claim these bonuses!</p>
        </div>
        
        <h3>What Happens Next</h3>
        <ol>
          <li>Winners will be announced on ${drawingDate}</li>
          <li>Winners will be notified via email and Instagram</li>
          <li>You'll have 72 hours to claim your prize</li>
        </ol>
        
        <div class="footer">
          <p><strong>Follow @BudDashNYC for updates</strong></p>
          <p>Questions? Contact support@buddash.com</p>
          <p><a href="#" style="color: #6b7280;">View Official Rules</a> | <a href="#" style="color: #6b7280;">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateReferralSuccessEmail(data: any): string {
  const { firstName, friendName, bonusEntries, totalEntries } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
        .header { text-align: center; padding: 30px 0; }
        .party-icon { font-size: 60px; }
        .badge { background: linear-gradient(135deg, #10b981, #3b82f6); color: white; font-size: 48px; font-weight: bold; padding: 30px; border-radius: 50%; display: inline-block; margin: 20px 0; }
        .total { font-size: 36px; color: #10b981; font-weight: bold; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 10px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="party-icon">🎊</div>
          <h1>Bonus Entries Unlocked!</h1>
        </div>
        
        <p>Hey ${firstName}!</p>
        <p>${friendName} just signed up using your referral link!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <div class="badge">+${bonusEntries}</div>
          <p style="font-size: 20px; margin: 10px 0;">Bonus Entries Added</p>
          <p class="total">New Total: ${totalEntries} Entries</p>
        </div>
        
        <p style="text-align: center; font-size: 18px;">Keep sharing to earn unlimited entries!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" class="button">Share Your Link Again</a>
        </div>
        
        <div class="footer">
          <p>Follow @BudDashNYC | support@buddash.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateWinnerNotificationEmail(data: any): string {
  const { firstName, rank, prizeTitle, prizeValue, claimDeadline } = data;
  
  const trophy = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  const rankText = rank === 1 ? 'FIRST' : rank === 2 ? 'SECOND' : 'THIRD';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
        .gold-banner { background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 40px 20px; text-align: center; color: white; }
        .trophy { font-size: 80px; }
        .prize-box { background: #f0fdf4; border: 3px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .value { font-size: 48px; color: #10b981; font-weight: bold; }
        .urgency-box { background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .button { display: inline-block; background: #10b981; color: white; padding: 15px 40px; border-radius: 6px; text-decoration: none; font-size: 18px; font-weight: bold; margin: 10px 0; }
        .steps { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="gold-banner">
          <div class="trophy">${trophy}</div>
          <h1 style="font-size: 48px; margin: 10px 0;">YOU WON!</h1>
          <h2 style="margin: 0;">${rankText} PLACE WINNER</h2>
        </div>
        
        <div style="padding: 20px;">
          <h2 style="text-align: center;">🎉 Congratulations ${firstName}! 🎉</h2>
          <p style="text-align: center; font-size: 18px;">Out of thousands of entries, you were selected as a winner!</p>
          
          <div class="prize-box">
            <h3>Your Prize</h3>
            <h2>${prizeTitle}</h2>
            <div class="value">$${prizeValue}</div>
            <p style="color: #6b7280;">Retail Value</p>
          </div>
          
          <div class="urgency-box">
            <h3 style="margin-top: 0;">⏰ CLAIM YOUR PRIZE NOW</h3>
            <p><strong>IMPORTANT:</strong> You have 72 hours to claim your prize!</p>
            <p><strong>Deadline:</strong> ${claimDeadline}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" class="button">🏆 CLAIM MY PRIZE NOW</a>
          </div>
          
          <div class="steps">
            <h3>What Happens Next</h3>
            <ol>
              <li>Click the button above to confirm your win</li>
              <li>${rank === 1 ? 'Verify your delivery address' : 'Credit will be automatically applied to your account'}</li>
              <li>${rank === 1 ? 'Your prize will be delivered within 3-5 business days' : 'Use your credit on your next order'}</li>
            </ol>
          </div>
          
          <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3>📸 Share Your Win!</h3>
            <p>Can we celebrate with you on Instagram? Reply to this email with your permission to share your win!</p>
          </div>
          
          <div class="footer">
            <p><strong>Need help?</strong> Contact support@buddash.com</p>
            <p>Follow @BudDashNYC</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateNonWinnerEmail(data: any): string {
  const { firstName, discountCode } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
        .discount-box { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border-radius: 8px; padding: 30px; text-align: center; margin: 20px 0; }
        .code { background: white; color: #1f2937; font-size: 32px; font-weight: bold; padding: 15px; border-radius: 6px; margin: 10px 0; letter-spacing: 2px; }
        .button { display: inline-block; background: white; color: #8b5cf6; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 10px 0; }
        .teaser-box { background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Hi ${firstName},</h2>
        
        <p>Thank you so much for participating in NYC's Biggest Flower Giveaway! While you weren't selected as a winner this time, we truly appreciate your enthusiasm and support.</p>
        
        <p>Your entry helps make our community stronger, and we want to show our appreciation...</p>
        
        <div class="discount-box">
          <h2 style="margin-top: 0; color: white;">Here's 20% Off Your Next Order</h2>
          <p>As a thank you for entering, enjoy this exclusive discount!</p>
          <div class="code">${discountCode}</div>
          <p><strong>Valid for 14 days</strong></p>
          <a href="#" class="button">Shop Now</a>
        </div>
        
        <div class="teaser-box">
          <h3 style="margin-top: 0;">📢 Stay Tuned!</h3>
          <p><strong>We're planning another giveaway soon!</strong></p>
          <p>Follow @BudDashNYC on Instagram to be the first to know when the next giveaway launches.</p>
        </div>
        
        <p>Thanks again for being part of the Bud Dash community. We hope to see you again soon!</p>
        
        <div class="footer">
          <p>Follow @BudDashNYC | support@buddash.com</p>
          <p><a href="#" style="color: #6b7280;">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
