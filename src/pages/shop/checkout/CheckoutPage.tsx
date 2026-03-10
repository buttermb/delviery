/**
 * CheckoutPage
 * Multi-step checkout flow orchestrator
 */

import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Clock, Loader2 } from 'lucide-react';

import { useLuxuryTheme } from '@/components/shop/luxury';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';

import { useCheckoutFlow } from './useCheckoutFlow';
import { StepIndicator } from './StepIndicator';
import { ContactStep } from './ContactStep';
import { FulfillmentStep } from './FulfillmentStep';
import { PaymentStep } from './PaymentStep';
import { ReviewStep } from './ReviewStep';
import { MobileOrderSummary } from './MobileOrderSummary';
import { OrderSummary } from './OrderSummary';
import { StickyMobileBar } from './StickyMobileBar';

export function CheckoutPage() {
  const flow = useCheckoutFlow();
  const { isLuxuryTheme, accentColor, cardBg, cardBorder, textPrimary, textMuted, inputBg, inputBorder, inputText } = useLuxuryTheme();

  if (!flow.store) return null;

  const themeColor = isLuxuryTheme ? accentColor : flow.store.primary_color;

  return (
    <div className={`container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl ${isLuxuryTheme ? 'min-h-dvh' : ''}`}>
      <StepIndicator
        currentStep={flow.currentStep}
        setCurrentStep={flow.setCurrentStep}
        themeColor={themeColor}
        isLuxuryTheme={isLuxuryTheme}
      />

      <MobileOrderSummary
        cartCount={flow.cartCount}
        cartItems={flow.cartItems}
        subtotal={flow.subtotal}
        effectiveDeliveryFee={flow.effectiveDeliveryFee}
        couponDiscount={flow.couponDiscount}
        total={flow.total}
        themeColor={themeColor}
        isLuxuryTheme={isLuxuryTheme}
        expanded={flow.mobileSummaryExpanded}
        onToggle={() => flow.setMobileSummaryExpanded(!flow.mobileSummaryExpanded)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Form */}
        <div className="lg:col-span-2">

          {/* Store Closed Warning */}
          {flow.isStoreClosed && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 mb-6">
              <Clock className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">Store is currently closed</AlertTitle>
              <AlertDescription className="text-yellow-500/90">
                {flow.storeStatus?.reason || 'We are currently closed for new orders.'}
                {flow.storeStatus?.nextOpen && ` We open again at ${flow.storeStatus.nextOpen}.`}
                {' '}You can still place a pre-order for delivery/pickup when we open.
              </AlertDescription>
            </Alert>
          )}

          {/* Express Checkout for Returning Customers */}
          {flow.hasSavedData && flow.currentStep < 3 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg border ${isLuxuryTheme ? 'bg-white/5 border-white/10' : 'bg-primary/5 border-primary/20'}`}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isLuxuryTheme ? 'bg-white/10' : 'bg-primary/10'}`}>
                    <Check className={`w-4 h-4 ${isLuxuryTheme ? 'text-white' : 'text-primary'}`} />
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${isLuxuryTheme ? 'text-white' : ''}`}>
                      Welcome back, {flow.formData.firstName}!
                    </p>
                    <p className={`text-xs ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`}>
                      Your info is saved. Ready to checkout?
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => flow.setCurrentStep(3)}
                  style={{ backgroundColor: themeColor }}
                  className="text-white"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Express Checkout
                </Button>
              </div>
            </motion.div>
          )}

          <Card className={isLuxuryTheme ? `${cardBg} ${cardBorder}` : ''}>
            <CardContent className="px-3 sm:px-6 pt-4 sm:pt-6 overflow-hidden">
              <AnimatePresence mode="wait">
                {flow.currentStep === 1 && (
                  <ContactStep
                    formData={flow.formData}
                    updateField={flow.updateField}
                    showErrors={flow.showErrors}
                    isLuxuryTheme={isLuxuryTheme}
                    requirePhone={flow.store.checkout_settings?.require_phone ?? false}
                    isLookingUpCustomer={flow.isLookingUpCustomer}
                    isRecognized={flow.isRecognized}
                    returningCustomerName={flow.returningCustomer?.firstName}
                    createAccount={flow.createAccount}
                    setCreateAccount={flow.setCreateAccount}
                    accountPassword={flow.accountPassword}
                    setAccountPassword={flow.setAccountPassword}
                  />
                )}

                {flow.currentStep === 2 && (
                  <FulfillmentStep
                    formData={flow.formData}
                    updateField={flow.updateField}
                    storeName={flow.store?.store_name}
                    showDeliveryNotes={flow.store.checkout_settings?.show_delivery_notes ?? false}
                  />
                )}

                {flow.currentStep === 3 && (
                  <PaymentStep
                    formData={flow.formData}
                    updateField={flow.updateField}
                    paymentMethods={flow.store.payment_methods || ['cash']}
                    isStripeConfigured={flow.isStripeConfigured}
                    venmoConfirmed={flow.venmoConfirmed}
                    setVenmoConfirmed={flow.setVenmoConfirmed}
                    zelleConfirmed={flow.zelleConfirmed}
                    setZelleConfirmed={flow.setZelleConfirmed}
                    venmoHandle={flow.store.checkout_settings?.venmo_handle}
                    zelleEmail={flow.store.checkout_settings?.zelle_email}
                  />
                )}

                {flow.currentStep === 4 && (
                  <ReviewStep
                    formData={flow.formData}
                    setCurrentStep={flow.setCurrentStep}
                    agreeToTerms={flow.agreeToTerms}
                    setAgreeToTerms={flow.setAgreeToTerms}
                    createAccount={flow.createAccount}
                    storeName={flow.store?.store_name}
                  />
                )}
              </AnimatePresence>

              {/* Navigation Buttons -- hidden on mobile (sticky bar handles it), visible on sm+ */}
              <div className="hidden sm:flex flex-row justify-between gap-3 mt-8">
                {flow.currentStep > 1 ? (
                  <Button variant="outline" onClick={flow.prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                ) : (
                  <Link to={`/shop/${flow.storeSlug}/cart`}>
                    <Button variant="outline">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Cart
                    </Button>
                  </Link>
                )}

                {flow.currentStep < 4 ? (
                  <Button
                    onClick={flow.nextStep}
                    style={{ backgroundColor: flow.store.primary_color }}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={flow.handlePlaceOrder}
                    disabled={flow.placeOrderMutation.isPending}
                    style={{ backgroundColor: flow.store.primary_color }}
                  >
                    {flow.placeOrderMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {flow.isStoreClosed ? (
                          <>
                            <Clock className="w-4 h-4 mr-2" />
                            Place Pre-Order
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Place Order
                          </>
                        )}
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Mobile-only back link (above sticky bar) */}
              <div className="sm:hidden mt-4">
                {flow.currentStep > 1 ? (
                  <Button variant="ghost" size="sm" onClick={flow.prevStep} className="text-muted-foreground">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                ) : (
                  <Link to={`/shop/${flow.storeSlug}/cart`}>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back to Cart
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <OrderSummary
          cartItems={flow.cartItems}
          subtotal={flow.subtotal}
          fulfillmentMethod={flow.formData.fulfillmentMethod}
          effectiveDeliveryFee={flow.effectiveDeliveryFee}
          couponDiscount={flow.couponDiscount}
          dealsDiscount={flow.dealsDiscount}
          loyaltyDiscount={flow.loyaltyDiscount}
          enableCartRounding={flow.enableCartRounding}
          roundingAdjustment={flow.roundingAdjustment}
          totalBeforeGiftCards={flow.totalBeforeGiftCards}
          giftCardAmount={flow.giftCardAmount}
          total={flow.total}
          couponCode={flow.couponCode}
          setCouponCode={flow.setCouponCode}
          isApplyingCoupon={flow.isApplyingCoupon}
          couponError={flow.couponError}
          setCouponError={flow.setCouponError}
          handleApplyCoupon={flow.handleApplyCoupon}
          appliedCoupon={flow.appliedCoupon}
          removeCoupon={flow.removeCoupon}
          giftCardCode={flow.giftCardCode}
          setGiftCardCode={flow.setGiftCardCode}
          isCheckingGiftCard={flow.isCheckingGiftCard}
          handleApplyGiftCard={flow.handleApplyGiftCard}
          appliedGiftCards={flow.appliedGiftCards}
          removeGiftCard={flow.removeGiftCard}
          storeId={flow.store?.id}
          customerEmail={flow.formData.email}
          loyaltyPointsUsed={flow.loyaltyPointsUsed}
          setLoyaltyDiscount={flow.setLoyaltyDiscount}
          setLoyaltyPointsUsed={flow.setLoyaltyPointsUsed}
          isLuxuryTheme={isLuxuryTheme}
          themeColor={themeColor}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textPrimary={textPrimary}
          textMuted={textMuted}
          inputBg={inputBg}
          inputBorder={inputBorder}
          inputText={inputText}
        />
      </div>

      <StickyMobileBar
        currentStep={flow.currentStep}
        total={flow.total}
        themeColor={themeColor}
        isPending={flow.placeOrderMutation.isPending}
        agreeToTerms={flow.agreeToTerms}
        isStoreClosed={flow.isStoreClosed}
        onNextStep={flow.nextStep}
        onPlaceOrder={flow.handlePlaceOrder}
      />
    </div>
  );
}

export default CheckoutPage;
