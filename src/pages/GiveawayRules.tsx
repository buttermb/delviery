import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GiveawayRules() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="bg-card border border-border rounded-lg p-8 space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black mb-2">Official Giveaway Rules</h1>
            <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
          </div>

          <section>
            <h2 className="text-2xl font-bold mb-4">1. Eligibility</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Must be 21 years of age or older</li>
              <li>Must be a resident of New York City (Manhattan, Brooklyn, Queens, Bronx, or Staten Island)</li>
              <li>Must have a valid Instagram account</li>
              <li>No purchase necessary to enter or win</li>
              <li>Employees and immediate family members of Bud Dash NYC are not eligible</li>
              <li>Void where prohibited by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. How to Enter</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Create a Bud Dash NYC account with valid email and password</li>
              <li>Follow @buddashnyc on Instagram</li>
              <li>Tag 2 or more friends in a comment or post about the giveaway</li>
              <li>Complete the entry form with accurate information</li>
              <li>One entry per person per giveaway</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Bonus Entries</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Base Entry (+1)</h3>
                <p className="text-muted-foreground">Automatically awarded upon completing account creation and entry form</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Newsletter Subscription (+1)</h3>
                <p className="text-muted-foreground">Subscribe to the Bud Dash NYC newsletter during entry</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Instagram Story (+2)</h3>
                <p className="text-muted-foreground">Share about the giveaway to your Instagram story and tag @buddashnyc</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Instagram Post (+5)</h3>
                <p className="text-muted-foreground">Create a post about the giveaway and tag @buddashnyc with 2+ friends</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Referrals (+3 each, unlimited)</h3>
                <p className="text-muted-foreground">Share your unique referral link. Earn +3 entries for each friend who signs up and enters</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Prizes</h2>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <h3 className="font-bold text-lg mb-2">🥇 Grand Prize - 1 Winner</h3>
                <p className="text-muted-foreground">1 LB Premium Flower - Retail Value: $4,000</p>
                <p className="text-muted-foreground mt-2">Full pound of premium cannabis flower delivered same-day to your door</p>
              </div>
              <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <h3 className="font-bold text-lg mb-2">🥈 Second Prize - 1 Winner</h3>
                <p className="text-muted-foreground">$200 Bud Dash Credit - Retail Value: $200</p>
                <p className="text-muted-foreground mt-2">Store credit for your next order</p>
              </div>
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <h3 className="font-bold text-lg mb-2">🥉 Third Prize - 1 Winner</h3>
                <p className="text-muted-foreground">$50 Bud Dash Credit - Retail Value: $50</p>
                <p className="text-muted-foreground mt-2">Store credit for any product</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Winner Selection</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Winners will be selected via random drawing on the announced end date</li>
              <li>Each entry number has an equal chance of winning</li>
              <li>Drawing will be conducted using cryptographically secure random number generation</li>
              <li>Three separate numbers will be drawn for three prizes</li>
              <li>Same person cannot win multiple prizes</li>
              <li>Disqualified entries are excluded from selection</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Winner Notification</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Winners will be notified via email and Instagram direct message within 24 hours of selection</li>
              <li>Winners have 72 hours (3 days) to respond and claim their prize</li>
              <li>Winner must verify identity and delivery address</li>
              <li>If winner does not respond within 72 hours, a backup winner will be selected</li>
              <li>Winner may be required to sign an affidavit of eligibility</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Prize Delivery</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Grand prize will be delivered within 3-5 business days of claim</li>
              <li>Store credits will be applied to winner's account immediately upon claim</li>
              <li>All prizes are subject to verification and compliance with local laws</li>
              <li>Winner is responsible for any applicable taxes</li>
              <li>Prizes cannot be transferred, exchanged, or redeemed for cash</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. General Conditions</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>By entering, participants agree to be bound by these official rules</li>
              <li>Sponsor reserves the right to verify eligibility and compliance with rules</li>
              <li>Fraudulent entries or suspicious activity will result in disqualification</li>
              <li>Sponsor reserves the right to disqualify any participant who violates rules</li>
              <li>Winner may be featured on Bud Dash NYC social media (with permission)</li>
              <li>Sponsor is not responsible for lost, late, or misdirected entries</li>
              <li>Void where prohibited by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. Privacy</h2>
            <p className="text-muted-foreground">
              Information collected during entry will be used solely for giveaway administration and in accordance 
              with our Privacy Policy. By entering, participants consent to receive emails related to the giveaway 
              and promotional communications (which can be unsubscribed from at any time).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. Sponsor</h2>
            <p className="text-muted-foreground mb-4">
              This giveaway is sponsored by Bud Dash NYC.
            </p>
            <p className="text-muted-foreground">
              For questions or concerns about this giveaway, please contact support@buddashnyc.com
            </p>
          </section>

          <div className="pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              These rules may be updated at any time. Participants are responsible for reviewing the most current version.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
