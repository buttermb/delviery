/**
 * Types for the Admin Setup Wizard
 * Step-by-step onboarding flow after first admin login
 */

export type SetupWizardStepId =
  | 'business-profile'
  | 'add-products'
  | 'delivery-zones'
  | 'invite-driver'
  | 'preview-storefront';

export interface SetupWizardStep {
  id: SetupWizardStepId;
  title: string;
  description: string;
  number: number;
}

export const SETUP_WIZARD_STEPS: SetupWizardStep[] = [
  {
    id: 'business-profile',
    title: 'Business Profile',
    description: 'Set up your business name, slug, and logo',
    number: 1,
  },
  {
    id: 'add-products',
    title: 'Add Products',
    description: 'Add your first products via CSV or manually',
    number: 2,
  },
  {
    id: 'delivery-zones',
    title: 'Delivery Zones',
    description: 'Set your delivery areas and fees',
    number: 3,
  },
  {
    id: 'invite-driver',
    title: 'Invite Driver',
    description: 'Invite your first delivery driver',
    number: 4,
  },
  {
    id: 'preview-storefront',
    title: 'Preview Storefront',
    description: 'Preview how your store looks to customers',
    number: 5,
  },
];

export interface SkipWarning {
  stepId: SetupWizardStepId;
  title: string;
  consequences: string[];
}

export const SKIP_WARNINGS: Record<SetupWizardStepId, SkipWarning> = {
  'business-profile': {
    stepId: 'business-profile',
    title: 'Skip Business Profile?',
    consequences: [
      'Your store will use a generic name',
      'No logo will appear on your storefront',
      'You can update this later in Settings',
    ],
  },
  'add-products': {
    stepId: 'add-products',
    title: 'Skip Adding Products?',
    consequences: [
      'Your storefront will be empty',
      'Customers won\'t be able to browse or order',
      'You can add products later from Inventory',
    ],
  },
  'delivery-zones': {
    stepId: 'delivery-zones',
    title: 'Skip Delivery Zones?',
    consequences: [
      'No delivery areas will be configured',
      'Customers won\'t be able to place delivery orders',
      'You can set this up later in Delivery Settings',
    ],
  },
  'invite-driver': {
    stepId: 'invite-driver',
    title: 'Skip Inviting a Driver?',
    consequences: [
      'You won\'t have anyone to fulfill deliveries',
      'Orders will need to be self-delivered',
      'You can invite drivers later from Team',
    ],
  },
  'preview-storefront': {
    stepId: 'preview-storefront',
    title: 'Skip Preview?',
    consequences: [
      'You won\'t see how customers experience your store',
      'You can preview anytime from the Storefront menu',
    ],
  },
};
