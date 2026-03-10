import { useState, useMemo, useCallback } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import type { MenuTemplate } from '@/components/admin/disposable-menus/MenuTemplates';
import type { MenuCreationWizardProps, InventoryProduct, GeofenceConfig } from '@/components/admin/disposable-menus/wizard/types';
import { STEPS, STANDARD_TIERS, generateAccessCode, validateEmail, validatePhone } from '@/components/admin/disposable-menus/wizard/types';
import { TemplateStep } from '@/components/admin/disposable-menus/wizard/TemplateStep';
import { DetailsStep } from '@/components/admin/disposable-menus/wizard/DetailsStep';
import { ProductsStep } from '@/components/admin/disposable-menus/wizard/ProductsStep';
import { AdvancedStep } from '@/components/admin/disposable-menus/wizard/AdvancedStep';
import { SettingsStep } from '@/components/admin/disposable-menus/wizard/SettingsStep';

import { useProductsForMenu } from '@/hooks/useProductsForMenu';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCreditGatedAction } from '@/hooks/useCredits';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const MenuCreationWizard = ({ open, onOpenChange }: MenuCreationWizardProps) => {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getCurrent, getLimit } = useTenantLimits();

  // Step navigation
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<MenuTemplate | null>(null);

  // Step 2 - Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 3 - Products
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minOrder, setMinOrder] = useState('5');
  const [maxOrder, setMaxOrder] = useState('50');

  // Step 4 - Advanced
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  const [tieredPrices, setTieredPrices] = useState<Record<string, Record<string, string>>>({});
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('10');
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);
  const [geofence, setGeofence] = useState<GeofenceConfig>({ lat: '', lng: '', radiusMiles: '5' });
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([]);
  const [whitelistedPhones, setWhitelistedPhones] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [showBranding, setShowBranding] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [headerImage, setHeaderImage] = useState('');
  const [advancedTab, setAdvancedTab] = useState('pricing');

  // Step 5 - Settings
  const [expirationDays, setExpirationDays] = useState('30');
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [maxViews, setMaxViews] = useState<string>('unlimited');
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [accessType, setAccessType] = useState<'invite_only' | 'shared' | 'hybrid'>('invite_only');
  const [requireAccessCode, setRequireAccessCode] = useState(true);
  const [accessCode, setAccessCode] = useState(generateAccessCode());

  // Data hooks
  const { data: inventory, isLoading: inventoryLoading } = useProductsForMenu(tenant?.id);
  const createMenu = useCreateDisposableMenu();
  const { execute: executeWithCredits } = useCreditGatedAction();

  // Derived state
  const isForumMenu = selectedTemplate?.menuType === 'forum';

  const visibleSteps = useMemo(() => {
    if (isForumMenu) return STEPS.filter((s) => s.id !== 3 && s.id !== 4);
    return STEPS;
  }, [isForumMenu]);

  const stepIndex = visibleSteps.findIndex((s) => s.id === currentStep);
  const progress = ((stepIndex + 1) / visibleSteps.length) * 100;
  const isLastStep = currentStep === visibleSteps[visibleSteps.length - 1]?.id;

  // Product helpers
  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    if (!searchQuery.trim()) return inventory;
    const query = searchQuery.toLowerCase();
    return (inventory as InventoryProduct[]).filter(
      (p) =>
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query),
    );
  }, [inventory, searchQuery]);

  const getProductById = useCallback(
    (id: string): InventoryProduct | undefined =>
      (inventory as InventoryProduct[] | undefined)?.find((p) => p.id === id),
    [inventory],
  );

  const getEffectivePrice = useCallback(
    (product: InventoryProduct): number => {
      const custom = customPrices[product.id];
      if (custom && parseFloat(custom) > 0) return parseFloat(custom);
      if (applyDiscount && discountPercent) {
        const d = parseFloat(discountPercent);
        if (d > 0 && d <= 100) return product.price * (1 - d / 100);
      }
      return product.price;
    },
    [customPrices, applyDiscount, discountPercent],
  );

  const setTierPrice = (productId: string, tierLabel: string, value: string) => {
    setTieredPrices((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [tierLabel]: value },
    }));
  };

  const buildProductPrices = (): Record<string, Array<{ label: string; price: number; weight_grams: number }>> => {
    const result: Record<string, Array<{ label: string; price: number; weight_grams: number }>> = {};
    for (const productId of selectedProducts) {
      const tiers = tieredPrices[productId];
      if (!tiers) continue;
      const arr: Array<{ label: string; price: number; weight_grams: number }> = [];
      for (const tier of STANDARD_TIERS) {
        const raw = tiers[tier.label];
        if (raw && raw.trim() !== '') {
          const price = parseFloat(raw);
          if (!isNaN(price) && price > 0) {
            arr.push({ label: tier.label, price, weight_grams: tier.weight_grams });
          }
        }
      }
      if (arr.length > 0) result[productId] = arr;
    }
    return result;
  };

  // Navigation
  const getNextStep = (current: number): number => {
    const idx = visibleSteps.findIndex((s) => s.id === current);
    return idx < visibleSteps.length - 1 ? visibleSteps[idx + 1].id : current;
  };

  const getPrevStep = (current: number): number => {
    const idx = visibleSteps.findIndex((s) => s.id === current);
    return idx > 0 ? visibleSteps[idx - 1].id : current;
  };

  const validateAdvancedStep = (): boolean => {
    for (const [productId, priceStr] of Object.entries(customPrices)) {
      if (priceStr.trim() !== '') {
        const price = parseFloat(priceStr);
        if (isNaN(price) || price < 0) {
          const product = getProductById(productId);
          toast.error(`Invalid price for ${product?.name ?? 'product'}`);
          return false;
        }
      }
    }
    if (applyDiscount) {
      const d = parseFloat(discountPercent);
      if (isNaN(d) || d <= 0 || d > 100) {
        toast.error('Discount must be between 1% and 100%');
        return false;
      }
    }
    if (geofencingEnabled) {
      const lat = parseFloat(geofence.lat);
      const lng = parseFloat(geofence.lng);
      const radius = parseFloat(geofence.radiusMiles);
      if (isNaN(lat) || lat < -90 || lat > 90) { toast.error('Latitude must be between -90 and 90'); return false; }
      if (isNaN(lng) || lng < -180 || lng > 180) { toast.error('Longitude must be between -180 and 180'); return false; }
      if (isNaN(radius) || radius <= 0 || radius > 100) { toast.error('Radius must be between 0.1 and 100 miles'); return false; }
    }
    if (whitelistEnabled) {
      for (const email of whitelistedEmails) {
        if (!validateEmail(email)) { toast.error(`Invalid email: ${email}`); return false; }
      }
      for (const phone of whitelistedPhones) {
        if (!validatePhone(phone)) { toast.error(`Invalid phone: ${phone}`); return false; }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedTemplate) { toast.error('Please select a template'); return; }
    if (currentStep === 2 && !name.trim()) { toast.error('Menu name is required'); return; }
    if (currentStep === 3 && !isForumMenu && selectedProducts.length === 0) { toast.error('Please select at least one product'); return; }
    if (currentStep === 4 && !validateAdvancedStep()) return;
    const next = getNextStep(currentStep);
    if (next !== currentStep) setCurrentStep(next);
  };

  const handleBack = () => {
    const prev = getPrevStep(currentStep);
    if (prev !== currentStep) setCurrentStep(prev);
  };

  const handleTemplateSelect = (template: MenuTemplate) => {
    setSelectedTemplate(template);
    const days = template.expirationDays;
    const daysStr = typeof days === 'string' && days === 'unlimited' ? 'unlimited' : String(days);
    setExpirationDays(daysStr);
    setBurnAfterRead(template.burnAfterRead);
    setMaxViews(template.maxViews === 'unlimited' ? 'unlimited' : String(template.maxViews));
    setAccessType(template.accessType);
    setRequireAccessCode(template.requireAccessCode);
    if (template.security_settings.require_geofence) setGeofencingEnabled(true);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const updated = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      if (!updated.includes(productId)) {
        setCustomPrices((prices) => { const u = { ...prices }; delete u[productId]; return u; });
        setTieredPrices((tp) => { const u = { ...tp }; delete u[productId]; return u; });
      }
      return updated;
    });
  };

  const resetForm = () => {
    setCurrentStep(1); setSelectedTemplate(null); setName(''); setDescription('');
    setSelectedProducts([]); setSearchQuery(''); setMinOrder('5'); setMaxOrder('50');
    setExpirationDays('30'); setBurnAfterRead(false); setMaxViews('unlimited');
    setRequirePassword(false); setPassword(''); setAccessCode(generateAccessCode());
    setCustomPrices({}); setTieredPrices({}); setApplyDiscount(false); setDiscountPercent('10');
    setGeofencingEnabled(false); setGeofence({ lat: '', lng: '', radiusMiles: '5' });
    setWhitelistEnabled(false); setWhitelistedEmails([]); setWhitelistedPhones([]);
    setEmailInput(''); setPhoneInput(''); setShowBranding(true); setCustomMessage('');
    setHeaderImage(''); setAdvancedTab('pricing');
  };

  const handleCreate = async () => {
    if (!name) return;
    if (!isForumMenu && selectedProducts.length === 0) { toast.error('Please select at least one product'); return; }
    if (requirePassword && !password.trim()) { toast.error('Password is required when password protection is enabled'); return; }
    if (!canCreate('menus')) {
      const current = getCurrent('menus');
      const limit = getLimit('menus');
      toast.error('Menu Limit Reached', {
        description: limit === Infinity
          ? 'Unable to create menu. Please contact support.'
          : `You've reached your menu limit (${current}/${limit === Infinity ? '\u221E' : limit}). Upgrade to Professional for unlimited menus.`,
      });
      return;
    }

    const expirationDate = expirationDays !== 'unlimited'
      ? new Date(Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const finalCustomPrices: Record<string, number> = {};
    for (const [productId, priceStr] of Object.entries(customPrices)) {
      if (priceStr.trim() !== '' && selectedProducts.includes(productId)) {
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) finalCustomPrices[productId] = price;
      }
    }
    if (applyDiscount && parseFloat(discountPercent) > 0) {
      const discount = parseFloat(discountPercent);
      for (const productId of selectedProducts) {
        if (!finalCustomPrices[productId]) {
          const product = getProductById(productId);
          if (product) finalCustomPrices[productId] = parseFloat((product.price * (1 - discount / 100)).toFixed(2));
        }
      }
    }

    const productPrices = buildProductPrices();

    await executeWithCredits('menu_create', async () => {
      await createMenu.mutateAsync({
        tenant_id: tenant?.id ?? '',
        name,
        description: isForumMenu ? (description ?? 'Community Forum Access Menu') : description,
        product_ids: isForumMenu ? [] : selectedProducts,
        min_order_quantity: isForumMenu ? undefined : parseFloat(minOrder),
        max_order_quantity: isForumMenu ? undefined : parseFloat(maxOrder),
        custom_prices: Object.keys(finalCustomPrices).length > 0 ? finalCustomPrices : undefined,
        product_prices: Object.keys(productPrices).length > 0 ? productPrices : undefined,
        access_code: requireAccessCode ? accessCode : generateAccessCode(),
        expiration_date: expirationDate || undefined,
        never_expires: !expirationDate,
        security_settings: {
          access_type: accessType,
          require_access_code: requireAccessCode,
          password_protection: requirePassword ? password : undefined,
          burn_after_read: burnAfterRead,
          max_views: maxViews !== 'unlimited' ? parseInt(maxViews) : undefined,
          menu_type: isForumMenu ? 'forum' : 'product',
          forum_url: isForumMenu ? '/community' : undefined,
          geofencing_enabled: geofencingEnabled,
          geofence: geofencingEnabled ? {
            lat: parseFloat(geofence.lat),
            lng: parseFloat(geofence.lng),
            radius_miles: parseFloat(geofence.radiusMiles),
          } : undefined,
          whitelist_enabled: whitelistEnabled,
          whitelisted_emails: whitelistEnabled ? whitelistedEmails : undefined,
          whitelisted_phones: whitelistEnabled ? whitelistedPhones : undefined,
        },
        appearance_settings: {
          show_branding: showBranding,
          custom_message: customMessage || undefined,
          header_image: headerImage || undefined,
          discount_applied: applyDiscount ? parseFloat(discountPercent) : undefined,
        },
      });
      onOpenChange(false);
      resetForm();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Menu</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {visibleSteps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-1',
                  currentStep === step.id && 'text-primary font-medium',
                  visibleSteps.findIndex((s) => s.id === currentStep) >
                    visibleSteps.findIndex((s) => s.id === step.id) && 'text-green-600',
                )}
              >
                <step.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] py-4">
          {currentStep === 1 && (
            <TemplateStep
              selectedTemplateId={selectedTemplate?.id}
              onSelectTemplate={handleTemplateSelect}
            />
          )}

          {currentStep === 2 && (
            <DetailsStep
              name={name}
              onNameChange={setName}
              description={description}
              onDescriptionChange={setDescription}
            />
          )}

          {currentStep === 3 && (
            <ProductsStep
              isForumMenu={!!isForumMenu}
              selectedProducts={selectedProducts}
              onToggleProduct={toggleProduct}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              filteredProducts={filteredProducts as InventoryProduct[]}
              inventoryLoading={inventoryLoading}
              minOrder={minOrder}
              onMinOrderChange={setMinOrder}
              maxOrder={maxOrder}
              onMaxOrderChange={setMaxOrder}
            />
          )}

          {currentStep === 4 && (
            <AdvancedStep
              advancedTab={advancedTab}
              onAdvancedTabChange={setAdvancedTab}
              applyDiscount={applyDiscount}
              onApplyDiscountChange={setApplyDiscount}
              discountPercent={discountPercent}
              onDiscountPercentChange={setDiscountPercent}
              selectedProducts={selectedProducts}
              getProductById={getProductById}
              getEffectivePrice={getEffectivePrice}
              customPrices={customPrices}
              onCustomPricesChange={setCustomPrices}
              tieredPrices={tieredPrices}
              onTierPriceChange={setTierPrice}
              geofencingEnabled={geofencingEnabled}
              onGeofencingEnabledChange={setGeofencingEnabled}
              geofence={geofence}
              onGeofenceChange={setGeofence}
              whitelistEnabled={whitelistEnabled}
              onWhitelistEnabledChange={setWhitelistEnabled}
              whitelistedEmails={whitelistedEmails}
              onWhitelistedEmailsChange={setWhitelistedEmails}
              whitelistedPhones={whitelistedPhones}
              onWhitelistedPhonesChange={setWhitelistedPhones}
              emailInput={emailInput}
              onEmailInputChange={setEmailInput}
              phoneInput={phoneInput}
              onPhoneInputChange={setPhoneInput}
              showBranding={showBranding}
              onShowBrandingChange={setShowBranding}
              headerImage={headerImage}
              onHeaderImageChange={setHeaderImage}
              customMessage={customMessage}
              onCustomMessageChange={setCustomMessage}
              businessName={tenant?.business_name}
            />
          )}

          {currentStep === 5 && (
            <SettingsStep
              accessType={accessType}
              onAccessTypeChange={setAccessType}
              requireAccessCode={requireAccessCode}
              onRequireAccessCodeChange={setRequireAccessCode}
              accessCode={accessCode}
              onGenerateNewCode={() => setAccessCode(generateAccessCode())}
              requirePassword={requirePassword}
              onRequirePasswordChange={setRequirePassword}
              password={password}
              onPasswordChange={setPassword}
              expirationDays={expirationDays}
              onExpirationDaysChange={setExpirationDays}
              burnAfterRead={burnAfterRead}
              onBurnAfterReadChange={setBurnAfterRead}
              maxViews={maxViews}
              onMaxViewsChange={setMaxViews}
              applyDiscount={applyDiscount}
              discountPercent={discountPercent}
              geofencingEnabled={geofencingEnabled}
              geofenceRadiusMiles={geofence.radiusMiles}
              whitelistEnabled={whitelistEnabled}
              whitelistedEmailCount={whitelistedEmails.length}
              whitelistedPhoneCount={whitelistedPhones.length}
              customPriceCount={Object.keys(customPrices).filter((id) => customPrices[id]?.trim()).length}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            Back
          </Button>
          {!isLastStep ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleCreate} disabled={createMenu.isPending}>
              {createMenu.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Menu'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
