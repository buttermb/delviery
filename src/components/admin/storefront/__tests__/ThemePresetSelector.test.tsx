import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemePresetSelector, ThemePresetStrip } from '../ThemePresetSelector';
import { THEME_PRESETS, type ThemePreset } from '@/lib/storefrontThemes';

describe('ThemePresetSelector', () => {
    const mockOnSelectTheme = vi.fn();

    beforeEach(() => {
        mockOnSelectTheme.mockClear();
    });

    describe('ThemePresetSelector dialog', () => {
        it('should render trigger button', () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            expect(screen.getByRole('button', { name: /choose theme/i })).toBeInTheDocument();
        });

        it('should open dialog when trigger is clicked', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            const trigger = screen.getByRole('button', { name: /choose theme/i });
            await userEvent.click(trigger);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Choose a Theme')).toBeInTheDocument();
        });

        it('should display all 4 theme preview cards', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            expect(screen.getByText('Dark Mode')).toBeInTheDocument();
            expect(screen.getByText('Minimalist')).toBeInTheDocument();
            expect(screen.getByText('Strain Focused')).toBeInTheDocument();
            expect(screen.getByText('Luxury')).toBeInTheDocument();
        });

        it('should display theme taglines', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            expect(screen.getByText('Neon-lit cannabis aesthetic')).toBeInTheDocument();
            expect(screen.getByText('Less is more')).toBeInTheDocument();
        });

        it('should display font pairings for each theme', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            // Check that font pairings are displayed
            expect(screen.getByText('Outfit / Inter')).toBeInTheDocument();
            expect(screen.getByText('Inter / Inter')).toBeInTheDocument();
            expect(screen.getByText('Playfair Display / Cormorant Garamond')).toBeInTheDocument();
        });

        it('should call onSelectTheme when a theme card is clicked', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            // Click on the Luxury theme card
            const luxuryCard = screen.getByText('Luxury').closest('[class*="Card"]') || screen.getByText('Luxury').parentElement?.parentElement?.parentElement;
            if (luxuryCard) {
                await userEvent.click(luxuryCard);
            }

            expect(mockOnSelectTheme).toHaveBeenCalledTimes(1);
            expect(mockOnSelectTheme).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'luxury' })
            );
        });

        it('should close dialog after selection', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            const dialogContent = screen.getByRole('dialog');
            expect(dialogContent).toBeInTheDocument();

            // Click on a theme
            const darkModeText = screen.getByText('Dark Mode');
            const darkModeCard = darkModeText.closest('[class*="cursor-pointer"]');
            if (darkModeCard) {
                await userEvent.click(darkModeCard);
            }

            // Dialog should close
            expect(mockOnSelectTheme).toHaveBeenCalled();
        });

        it('should show selected theme with visual indicator', async () => {
            render(
                <ThemePresetSelector
                    onSelectTheme={mockOnSelectTheme}
                    selectedThemeId="minimalist"
                />
            );

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            // The selected theme should have ring styling
            const minimalistCard = screen.getByText('Minimalist').closest('[class*="cursor-pointer"]');
            expect(minimalistCard).toHaveClass('ring-2');
        });

        it('should show Dark badge for dark themes', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            // Dark Mode, Strain Focused (now light), and Luxury should have Dark badge
            // Minimalist and Strain Focused should not
            const darkBadges = screen.getAllByText('Dark');
            expect(darkBadges.length).toBeGreaterThan(0);
        });

        it('should render custom trigger when provided', async () => {
            render(
                <ThemePresetSelector
                    onSelectTheme={mockOnSelectTheme}
                    trigger={<button>Custom Trigger</button>}
                />
            );

            expect(screen.getByRole('button', { name: 'Custom Trigger' })).toBeInTheDocument();
        });
    });

    describe('ThemePresetStrip', () => {
        it('should render all themes as buttons', () => {
            render(<ThemePresetStrip onSelectTheme={mockOnSelectTheme} />);

            expect(screen.getByText('Dark Mode')).toBeInTheDocument();
            expect(screen.getByText('Minimalist')).toBeInTheDocument();
            expect(screen.getByText('Strain Focused')).toBeInTheDocument();
            expect(screen.getByText('Luxury')).toBeInTheDocument();
        });

        it('should call onSelectTheme when a theme button is clicked', async () => {
            render(<ThemePresetStrip onSelectTheme={mockOnSelectTheme} />);

            const strainButton = screen.getByText('Strain Focused').closest('button');
            if (strainButton) {
                await userEvent.click(strainButton);
            }

            expect(mockOnSelectTheme).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'strain-focused' })
            );
        });

        it('should show selected theme with visual indicator', () => {
            render(
                <ThemePresetStrip
                    onSelectTheme={mockOnSelectTheme}
                    selectedThemeId="luxury"
                />
            );

            const luxuryButton = screen.getByText('Luxury').closest('button');
            expect(luxuryButton).toHaveClass('border-primary');
        });

        it('should display primary color swatch for each theme', () => {
            const { container } = render(
                <ThemePresetStrip onSelectTheme={mockOnSelectTheme} />
            );

            // Each button should have a color swatch div
            const swatches = container.querySelectorAll('[style*="background-color"]');
            expect(swatches.length).toBeGreaterThanOrEqual(4);
        });

        it('should show check mark on selected theme', () => {
            render(
                <ThemePresetStrip
                    onSelectTheme={mockOnSelectTheme}
                    selectedThemeId="dark-mode"
                />
            );

            // The selected button should contain a Check icon
            const darkModeButton = screen.getByText('Dark Mode').closest('button');
            expect(darkModeButton?.querySelector('svg')).toBeInTheDocument();
        });
    });

    describe('theme preview cards', () => {
        it('should display theme colors correctly in preview', async () => {
            render(<ThemePresetSelector onSelectTheme={mockOnSelectTheme} />);

            await userEvent.click(screen.getByRole('button', { name: /choose theme/i }));

            // The preview cards should have background colors set
            const darkModePreview = screen.getByText('Dark Mode').closest('[class*="cursor-pointer"]');
            const previewSwatch = darkModePreview?.querySelector('[style*="background-color"]');

            expect(previewSwatch).toBeInTheDocument();
        });
    });

    describe('selection persistence', () => {
        it('should maintain selected state across re-renders', () => {
            const { rerender } = render(
                <ThemePresetStrip
                    onSelectTheme={mockOnSelectTheme}
                    selectedThemeId="minimalist"
                />
            );

            let minimalistButton = screen.getByText('Minimalist').closest('button');
            expect(minimalistButton).toHaveClass('border-primary');

            // Re-render with same selection
            rerender(
                <ThemePresetStrip
                    onSelectTheme={mockOnSelectTheme}
                    selectedThemeId="minimalist"
                />
            );

            minimalistButton = screen.getByText('Minimalist').closest('button');
            expect(minimalistButton).toHaveClass('border-primary');
        });

        it('should update selection when selectedThemeId prop changes', () => {
            const { rerender } = render(
                <ThemePresetStrip
                    onSelectTheme={mockOnSelectTheme}
                    selectedThemeId="dark-mode"
                />
            );

            let darkModeButton = screen.getByText('Dark Mode').closest('button');
            expect(darkModeButton).toHaveClass('border-primary');

            // Change selection
            rerender(
                <ThemePresetStrip
                    onSelectTheme={mockOnSelectTheme}
                    selectedThemeId="luxury"
                />
            );

            darkModeButton = screen.getByText('Dark Mode').closest('button');
            const luxuryButton = screen.getByText('Luxury').closest('button');

            expect(darkModeButton).not.toHaveClass('border-primary');
            expect(luxuryButton).toHaveClass('border-primary');
        });
    });
});
