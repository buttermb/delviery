/**
 * BuilderLeftPanel Tests
 * Tests for aria-labels, stable keys, accessibility, and rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { BuilderLeftPanel } from '../BuilderLeftPanel';
import { SECTION_TYPES, TEMPLATES, type SectionConfig, type ThemeConfig, type TemplateKey } from '../storefront-builder.config';

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn().mockReturnValue([]),
  DragStartEvent: {},
  DragEndEvent: {},
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((arr: unknown[]) => arr),
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn().mockReturnValue({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn() } },
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
  restrictToParentElement: vi.fn(),
}));

// Mock section components used in config
vi.mock('@/components/shop/sections/HeroSection', () => ({
  HeroSection: () => <div>Hero</div>,
}));
vi.mock('@/components/shop/sections/FeaturesSection', () => ({
  FeaturesSection: () => <div>Features</div>,
}));
vi.mock('@/components/shop/sections/ProductGridSection', () => ({
  ProductGridSection: () => <div>Products</div>,
}));
vi.mock('@/components/shop/sections/TestimonialsSection', () => ({
  TestimonialsSection: () => <div>Testimonials</div>,
}));
vi.mock('@/components/shop/sections/NewsletterSection', () => ({
  NewsletterSection: () => <div>Newsletter</div>,
}));
vi.mock('@/components/shop/sections/GallerySection', () => ({
  GallerySection: () => <div>Gallery</div>,
}));
vi.mock('@/components/shop/sections/FAQSection', () => ({
  FAQSection: () => <div>FAQ</div>,
}));
vi.mock('@/components/shop/sections/CustomHTMLSection', () => ({
  CustomHTMLSection: () => <div>Custom HTML</div>,
}));

const defaultTheme: ThemeConfig = {
  colors: { primary: '#000000', secondary: '#ffffff', accent: '#3b82f6', background: '#ffffff', text: '#000000' },
  typography: { fontFamily: 'Inter' },
};

const mockSections: SectionConfig[] = [
  { id: 'sec-hero', type: 'hero', content: {}, styles: {}, visible: true },
  { id: 'sec-features', type: 'features', content: {}, styles: {}, visible: true },
  { id: 'sec-faq', type: 'faq', content: {}, styles: {}, visible: false },
];

function renderPanel(overrides: Partial<Parameters<typeof BuilderLeftPanel>[0]> = {}) {
  const defaultProps = {
    activeTab: 'sections',
    setActiveTab: vi.fn(),
    layoutConfig: mockSections,
    setLayoutConfig: vi.fn(),
    themeConfig: defaultTheme,
    setThemeConfig: vi.fn(),
    selectedSectionId: null,
    onAddSection: vi.fn(),
    onSelectSection: vi.fn(),
    onRemoveSection: vi.fn(),
    onDuplicateSection: vi.fn(),
    onToggleVisibility: vi.fn(),
    onApplyTemplate: vi.fn(),
    saveToHistory: vi.fn(),
    ...overrides,
  };

  return { ...render(<BuilderLeftPanel {...defaultProps} />), props: defaultProps };
}

describe('BuilderLeftPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sections Tab', () => {
    it('renders all section type add buttons with aria-labels', () => {
      renderPanel();

      for (const [, { label }] of Object.entries(SECTION_TYPES)) {
        expect(screen.getByRole('button', { name: `Add ${label}` })).toBeInTheDocument();
      }
    });

    it('calls onAddSection when a section type button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'Add Hero Section' }));
      expect(props.onAddSection).toHaveBeenCalledWith('hero');
    });

    it('renders existing layout sections', () => {
      renderPanel();

      const sectionItems = screen.getAllByTestId(/^builder-section-/);
      expect(sectionItems).toHaveLength(3);
      expect(sectionItems[0].getAttribute('data-section-type')).toBe('hero');
      expect(sectionItems[1].getAttribute('data-section-type')).toBe('features');
      expect(sectionItems[2].getAttribute('data-section-type')).toBe('faq');
    });

    it('shows empty state when no sections exist', () => {
      renderPanel({ layoutConfig: [] });

      expect(screen.getByText('No sections added')).toBeInTheDocument();
    });

    it('highlights selected section', () => {
      renderPanel({ selectedSectionId: 'sec-hero' });

      const heroSection = screen.getByTestId('builder-section-hero');
      expect(heroSection.className).toContain('border-primary');
    });
  });

  describe('Templates Tab', () => {
    it('renders all template cards with aria-labels', () => {
      renderPanel({ activeTab: 'templates' });

      for (const [, template] of Object.entries(TEMPLATES)) {
        expect(screen.getByRole('button', { name: `Apply ${template.name} template` })).toBeInTheDocument();
      }
    });

    it('calls onApplyTemplate when template card is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel({ activeTab: 'templates' });

      await user.click(screen.getByRole('button', { name: 'Apply Minimal template' }));
      expect(props.onApplyTemplate).toHaveBeenCalledWith('minimal');
    });

    it('renders template section badges', () => {
      renderPanel({ activeTab: 'templates' });

      // Minimal template has hero and product_grid — badges show first word of label
      const minimalCard = screen.getByRole('button', { name: 'Apply Minimal template' });
      expect(within(minimalCard).getByText('Hero')).toBeInTheDocument();
      expect(within(minimalCard).getByText('Product')).toBeInTheDocument();
    });
  });

  describe('Theme Tab', () => {
    it('renders color pickers with aria-labels', () => {
      renderPanel({ activeTab: 'theme' });

      const colorKeys = ['primary', 'secondary', 'accent', 'background', 'text'];
      for (const key of colorKeys) {
        expect(screen.getByLabelText(`${key} color picker`)).toBeInTheDocument();
        expect(screen.getByLabelText(`${key} color value`)).toBeInTheDocument();
      }
    });

    it('renders typography selector', () => {
      renderPanel({ activeTab: 'theme' });

      expect(screen.getByText('Typography')).toBeInTheDocument();
    });

    it('calls setThemeConfig when color value changes', async () => {
      const user = userEvent.setup();
      const { props } = renderPanel({ activeTab: 'theme' });

      const primaryInput = screen.getByLabelText('primary color value');
      await user.clear(primaryInput);
      await user.type(primaryInput, '#ff0000');

      expect(props.setThemeConfig).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('section add buttons have descriptive aria-labels', () => {
      renderPanel();

      const buttons = screen.getAllByRole('button', { name: /^Add / });
      expect(buttons.length).toBe(Object.keys(SECTION_TYPES).length);
    });

    it('SortableSectionItem buttons have aria-labels', () => {
      renderPanel();

      expect(screen.getAllByLabelText('Show section').length + screen.getAllByLabelText('Hide section').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('Duplicate section').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('Remove section').length).toBeGreaterThan(0);
    });

    it('drag handles have aria-labels with section name', () => {
      renderPanel();

      expect(screen.getByLabelText('Reorder Hero Section')).toBeInTheDocument();
      expect(screen.getByLabelText('Reorder Features Grid')).toBeInTheDocument();
      expect(screen.getByLabelText('Reorder FAQ')).toBeInTheDocument();
    });

    it('template cards have role=button for keyboard access', () => {
      renderPanel({ activeTab: 'templates' });

      const templateButtons = screen.getAllByRole('button', { name: /^Apply .+ template$/ });
      expect(templateButtons.length).toBe(Object.keys(TEMPLATES).length);
    });
  });
});
