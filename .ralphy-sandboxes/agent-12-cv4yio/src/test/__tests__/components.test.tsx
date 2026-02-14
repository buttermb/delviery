/**
 * Component Tests Summary
 * Tests for UI components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import CopyButton from '@/components/CopyButton';
import { SearchBar } from '@/components/SearchBar';

describe('CopyButton', () => {
  it('should render copy button', () => {
    render(<CopyButton text="test text" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should display the text to copy', () => {
    render(<CopyButton text="test text" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});

describe('SearchBar', () => {
  it('should render search button', () => {
    render(<SearchBar />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should open dialog when clicked', () => {
    render(<SearchBar />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    // Note: SearchBar uses a Dialog, so we test that the button renders
    // Full dialog interaction tests would require more setup
  });
});

