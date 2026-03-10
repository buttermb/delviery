import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { sanitizeFormInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useWholesaleInventory } from '@/hooks/useWholesaleData';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useBulkGenerateImages } from '@/hooks/useProductImages';
import { toast } from 'sonner';
import { MenuAccessDetails } from '@/components/admin/disposable-menus/MenuAccessDetails';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useFreeTierLimits } from '@/hooks/useFreeTierLimits';
import type { CreateMenuDialogProps, InventoryProduct, CreatedMenuDetails, AccessType, AppearanceStyle, MenuOptions } from './types';
import { STEPS, generateAccessCode } from './types';
import { StepBasicInfo } from './StepBasicInfo';
import { StepProducts } from './StepProducts';
import { StepPricing } from './StepPricing';
import { StepExpiration } from './StepExpiration';
import { StepAccess } from './StepAccess';
import { StepSecurity } from './StepSecurity';
import { StepWhitelist } from './StepWhitelist';
import { StepNotifications } from './StepNotifications';
import { StepBranding } from './StepBranding';

export const CreateMenuDialog = ({ open, onOpenChange }: CreateMenuDialogProps) => {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getCurrent, getLimit } = useTenantLimits();
  const { checkLimit, recordAction, limitsApply } = useFreeTierLimits();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Products
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [minOrder, setMinOrder] = useState('5');
  const [maxOrder, setMaxOrder] = useState('50');

  // Step 3: Pricing
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(10);

  // Step 4: Expiration
  const [expirationHours, setExpirationHours] = useState<number>(168);
  const [maxViews, setMaxViews] = useState<number>(100);
  const [neverExpires, setNeverExpires] = useState(false);

  // Step 5: Access
  const [accessType, setAccessType] = useState<AccessType>('invite_only');
  const [requireAccessCode, setRequireAccessCode] = useState(true);
  const [accessCode, setAccessCode] = useState(generateAccessCode());

  // Step 6: Security
  const [requireGeofence, setRequireGeofence] = useState(false);
  const [geofenceLat, setGeofenceLat] = useState('40.7128');
  const [geofenceLng, setGeofenceLng] = useState('-74.0060');
  const [geofenceRadius, setGeofenceRadius] = useState('25');
  const [geofenceLocation, setGeofenceLocation] = useState('New York City');
  const [timeRestrictions, setTimeRestrictions] = useState(false);
  const [allowedHoursStart, setAllowedHoursStart] = useState('9');
  const [allowedHoursEnd, setAllowedHoursEnd] = useState('21');
  const [screenshotProtection, setScreenshotProtection] = useState(true);
  const [screenshotWatermark, setScreenshotWatermark] = useState(true);
  const [deviceLocking, setDeviceLocking] = useState(false);
  const [autoBurnHours, setAutoBurnHours] = useState<string>('never');

  // Step 7: Whitelist
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([]);
  const [whitelistedPhones, setWhitelistedPhones] = useState<string[]>([]);

  // Step 8: Notifications
  const [notifyOnSuspiciousIp, setNotifyOnSuspiciousIp] = useState(true);
  const [notifyOnFailedCode, setNotifyOnFailedCode] = useState(true);
  const [notifyOnHighViews, setNotifyOnHighViews] = useState(true);
  const [notifyOnShareAttempt, setNotifyOnShareAttempt] = useState(true);
  const [notifyOnGeofenceViolation, setNotifyOnGeofenceViolation] = useState(true);

  // Step 9: Branding
  const [showBranding, setShowBranding] = useState(true);
  const [appearanceStyle, setAppearanceStyle] = useState<AppearanceStyle>('professional');
  const [showProductImages, setShowProductImages] = useState(true);
  const [showAvailability, setShowAvailability] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [headerImage, setHeaderImage] = useState('');

  // Created menu details
  const [createdMenuDetails, setCreatedMenuDetails] = useState<CreatedMenuDetails | null>(null);

  // Reset all form state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setName('');
      setDescription('');
      setSelectedProducts([]);
      setProductSearch('');
      setMinOrder('5');
      setMaxOrder('50');
      setCustomPrices({});
      setApplyDiscount(false);
      setDiscountPercent(10);
      setExpirationHours(168);
      setMaxViews(100);
      setNeverExpires(false);
      setAccessType('invite_only');
      setRequireAccessCode(true);
      setAccessCode(generateAccessCode());
      setRequireGeofence(false);
      setGeofenceLat('40.7128');
      setGeofenceLng('-74.0060');
      setGeofenceRadius('25');
      setGeofenceLocation('New York City');
      setTimeRestrictions(false);
      setAllowedHoursStart('9');
      setAllowedHoursEnd('21');
      setScreenshotProtection(true);
      setScreenshotWatermark(true);
      setDeviceLocking(false);
      setAutoBurnHours('never');
      setWhitelistEnabled(false);
      setWhitelistedEmails([]);
      setWhitelistedPhones([]);
      setNotifyOnSuspiciousIp(true);
      setNotifyOnFailedCode(true);
      setNotifyOnHighViews(true);
      setNotifyOnShareAttempt(true);
      setNotifyOnGeofenceViolation(true);
      setShowBranding(true);
      setAppearanceStyle('professional');
      setShowProductImages(true);
      setShowAvailability(true);
      setShowContactInfo(false);
      setCustomMessage('');
      setHeaderImage('');
    }
  // Deps: only `open` matters. All other calls are React state setters (stable).
  }, [open]);

  const { data: inventory } = useWholesaleInventory(tenant?.id);
  const createMenu = useCreateDisposableMenu();
  const bulkGenerateImages = useBulkGenerateImages();

  const progress = (currentStep / STEPS.length) * 100;

  const [showLongLoadingMessage, setShowLongLoadingMessage] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (createMenu.isPending) {
      timer = setTimeout(() => setShowLongLoadingMessage(true), 5000);
    } else {
      setShowLongLoadingMessage(false);
    }
    return () => clearTimeout(timer);
  }, [createMenu.isPending]);

  const handleNext = () => {
    if (currentStep === 1 && !name.trim()) {
      toast.error('Please enter a menu name');
      return;
    }
    if (currentStep === 2 && selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleCreate = async () => {
    if (!name || selectedProducts.length === 0) return;

    if (!canCreate('menus')) {
      const current = getCurrent('menus');
      const limit = getLimit('menus');
      toast.error('Menu Limit Reached', {
        description:
          limit === Infinity
            ? 'Unable to create menu. Please contact support.'
            : `You've reached your menu limit (${current}/${limit === Infinity ? '\u221E' : limit}). Upgrade to Professional for unlimited menus.`,
      });
      return;
    }

    if (limitsApply) {
      const limitCheck = checkLimit('menus_per_day');
      if (!limitCheck.allowed) {
        toast.error('Daily Menu Limit Reached', {
          description: limitCheck.message,
        });
        return;
      }
    }

    try {
      const result = await createMenu.mutateAsync({
        tenant_id: tenant?.id ?? '',
        name: sanitizeFormInput(name, 200),
        description: sanitizeTextareaInput(description, 500),
        product_ids: selectedProducts,
        min_order_quantity: parseFloat(minOrder),
        max_order_quantity: parseFloat(maxOrder),
        access_code: requireAccessCode ? accessCode : generateAccessCode(),
        security_settings: {
          access_type: accessType,
          require_access_code: requireAccessCode,
          require_geofence: requireGeofence,
          geofence_radius: requireGeofence ? parseFloat(geofenceRadius) : null,
          geofence_location: requireGeofence ? sanitizeFormInput(geofenceLocation, 200) : null,
          geofence_lat: requireGeofence ? parseFloat(geofenceLat) : null,
          geofence_lng: requireGeofence ? parseFloat(geofenceLng) : null,
          time_restrictions: timeRestrictions,
          allowed_hours: timeRestrictions
            ? { start: parseInt(allowedHoursStart), end: parseInt(allowedHoursEnd) }
            : null,
          view_limit: maxViews > 0 && maxViews < 1000 ? maxViews : null,
          screenshot_protection: { enabled: screenshotProtection, watermark: screenshotWatermark },
          device_locking: { enabled: deviceLocking },
          auto_burn_hours: autoBurnHours !== 'never' ? parseInt(autoBurnHours) : null,
          expiration_hours: neverExpires ? null : expirationHours,
          custom_prices: Object.keys(customPrices).length > 0 ? customPrices : null,
          apply_discount: applyDiscount,
          discount_percent: applyDiscount ? discountPercent : null,
          whitelist_enabled: whitelistEnabled,
          whitelisted_emails: whitelistEnabled ? whitelistedEmails : [],
          whitelisted_phones: whitelistEnabled ? whitelistedPhones : [],
          notification_settings: {
            suspicious_ip: notifyOnSuspiciousIp,
            failed_code: notifyOnFailedCode,
            high_views: notifyOnHighViews,
            share_attempt: notifyOnShareAttempt,
            geofence_violation: notifyOnGeofenceViolation,
          },
          appearance_style: appearanceStyle,
          show_product_images: showProductImages,
          show_availability: showAvailability,
          show_contact_info: showContactInfo,
          show_branding: showBranding,
          custom_message: sanitizeFormInput(customMessage, 500),
          header_image: headerImage || null,
        },
      });

      if (limitsApply) {
        await recordAction('menu');
      }

      if (result.access_code && result.shareable_url) {
        setCreatedMenuDetails({
          accessCode: result.access_code,
          shareableUrl: result.shareable_url,
          menuName: name,
        });
      }

      toast.success('Menu created successfully!');

      // Reset all state
      setCurrentStep(1);
      setName('');
      setDescription('');
      setSelectedProducts([]);
      setCustomPrices({});
      setApplyDiscount(false);
      setDiscountPercent(10);
      setWhitelistedEmails([]);
      setWhitelistedPhones([]);
      setAccessType('invite_only');
      setRequireAccessCode(true);
      setAccessCode(generateAccessCode());
      onOpenChange(false);
    } catch (error) {
      logger.error('Error creating menu', error, { component: 'CreateMenuDialog' });
    }
  };

  // Build the MenuOptions for summary
  const menuOptions: MenuOptions = {
    name,
    products: selectedProducts,
    customPrices,
    applyDiscount,
    discountPercent,
    expirationHours,
    maxViews,
    accessCodeEnabled: requireAccessCode,
    accessCode,
    geofencingEnabled: requireGeofence,
    geofence: requireGeofence
      ? { lat: parseFloat(geofenceLat), lng: parseFloat(geofenceLng), radiusMiles: parseFloat(geofenceRadius) }
      : null,
    whitelistEnabled,
    whitelistedEmails,
    whitelistedPhones,
    showBranding,
    customMessage,
    headerImage,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Disposable Menu</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground overflow-x-auto">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 whitespace-nowrap px-0.5 ${
                  currentStep === step.id ? 'text-primary font-medium' : ''
                } ${currentStep > step.id ? 'text-green-600' : ''}`}
              >
                <step.icon className="h-3 w-3" />
                <span className="hidden lg:inline">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] py-4">
          {currentStep === 1 && (
            <StepBasicInfo
              name={name}
              onNameChange={setName}
              description={description}
              onDescriptionChange={setDescription}
            />
          )}

          {currentStep === 2 && (
            <StepProducts
              inventory={inventory as InventoryProduct[] | undefined}
              selectedProducts={selectedProducts}
              onSelectedProductsChange={setSelectedProducts}
              productSearch={productSearch}
              onProductSearchChange={setProductSearch}
              minOrder={minOrder}
              onMinOrderChange={setMinOrder}
              maxOrder={maxOrder}
              onMaxOrderChange={setMaxOrder}
              bulkGenerateImages={bulkGenerateImages}
            />
          )}

          {currentStep === 3 && (
            <StepPricing
              inventory={inventory as InventoryProduct[] | undefined}
              selectedProducts={selectedProducts}
              customPrices={customPrices}
              onCustomPricesChange={setCustomPrices}
              applyDiscount={applyDiscount}
              onApplyDiscountChange={setApplyDiscount}
              discountPercent={discountPercent}
              onDiscountPercentChange={setDiscountPercent}
            />
          )}

          {currentStep === 4 && (
            <StepExpiration
              expirationHours={expirationHours}
              onExpirationHoursChange={setExpirationHours}
              maxViews={maxViews}
              onMaxViewsChange={setMaxViews}
              neverExpires={neverExpires}
              onNeverExpiresChange={setNeverExpires}
            />
          )}

          {currentStep === 5 && (
            <StepAccess
              accessType={accessType}
              onAccessTypeChange={setAccessType}
              requireAccessCode={requireAccessCode}
              onRequireAccessCodeChange={setRequireAccessCode}
              accessCode={accessCode}
              onAccessCodeChange={setAccessCode}
            />
          )}

          {currentStep === 6 && (
            <StepSecurity
              requireGeofence={requireGeofence}
              onRequireGeofenceChange={setRequireGeofence}
              geofenceLat={geofenceLat}
              onGeofenceLatChange={setGeofenceLat}
              geofenceLng={geofenceLng}
              onGeofenceLngChange={setGeofenceLng}
              geofenceRadius={geofenceRadius}
              onGeofenceRadiusChange={setGeofenceRadius}
              geofenceLocation={geofenceLocation}
              onGeofenceLocationChange={setGeofenceLocation}
              timeRestrictions={timeRestrictions}
              onTimeRestrictionsChange={setTimeRestrictions}
              allowedHoursStart={allowedHoursStart}
              onAllowedHoursStartChange={setAllowedHoursStart}
              allowedHoursEnd={allowedHoursEnd}
              onAllowedHoursEndChange={setAllowedHoursEnd}
              screenshotProtection={screenshotProtection}
              onScreenshotProtectionChange={setScreenshotProtection}
              screenshotWatermark={screenshotWatermark}
              onScreenshotWatermarkChange={setScreenshotWatermark}
              deviceLocking={deviceLocking}
              onDeviceLockingChange={setDeviceLocking}
              autoBurnHours={autoBurnHours}
              onAutoBurnHoursChange={setAutoBurnHours}
            />
          )}

          {currentStep === 7 && (
            <StepWhitelist
              whitelistEnabled={whitelistEnabled}
              onWhitelistEnabledChange={setWhitelistEnabled}
              whitelistedEmails={whitelistedEmails}
              onWhitelistedEmailsChange={setWhitelistedEmails}
              whitelistedPhones={whitelistedPhones}
              onWhitelistedPhonesChange={setWhitelistedPhones}
            />
          )}

          {currentStep === 8 && (
            <StepNotifications
              notifyOnSuspiciousIp={notifyOnSuspiciousIp}
              onNotifyOnSuspiciousIpChange={setNotifyOnSuspiciousIp}
              notifyOnFailedCode={notifyOnFailedCode}
              onNotifyOnFailedCodeChange={setNotifyOnFailedCode}
              notifyOnHighViews={notifyOnHighViews}
              onNotifyOnHighViewsChange={setNotifyOnHighViews}
              notifyOnShareAttempt={notifyOnShareAttempt}
              onNotifyOnShareAttemptChange={setNotifyOnShareAttempt}
              notifyOnGeofenceViolation={notifyOnGeofenceViolation}
              onNotifyOnGeofenceViolationChange={setNotifyOnGeofenceViolation}
            />
          )}

          {currentStep === 9 && (
            <StepBranding
              showBranding={showBranding}
              onShowBrandingChange={setShowBranding}
              appearanceStyle={appearanceStyle}
              onAppearanceStyleChange={setAppearanceStyle}
              showProductImages={showProductImages}
              onShowProductImagesChange={setShowProductImages}
              showAvailability={showAvailability}
              onShowAvailabilityChange={setShowAvailability}
              showContactInfo={showContactInfo}
              onShowContactInfoChange={setShowContactInfo}
              customMessage={customMessage}
              onCustomMessageChange={setCustomMessage}
              headerImage={headerImage}
              onHeaderImageChange={setHeaderImage}
              menuOptions={menuOptions}
              neverExpires={neverExpires}
              accessType={accessType}
              requireAccessCode={requireAccessCode}
              requireGeofence={requireGeofence}
              timeRestrictions={timeRestrictions}
              screenshotProtection={screenshotProtection}
              deviceLocking={deviceLocking}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="flex flex-col items-center">
              <Button
                onClick={handleCreate}
                disabled={createMenu.isPending}
                className="w-full"
              >
                {createMenu.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Menu'
                )}
              </Button>
              {showLongLoadingMessage && (
                <p className="text-xs text-yellow-600 text-center mt-2 animate-pulse">
                  This is taking longer than usual. Please wait...
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      <MenuAccessDetails
        open={createdMenuDetails !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCreatedMenuDetails(null);
        }}
        accessCode={createdMenuDetails?.accessCode ?? ''}
        shareableUrl={createdMenuDetails?.shareableUrl ?? ''}
        menuName={createdMenuDetails?.menuName ?? ''}
      />
    </Dialog>
  );
};
