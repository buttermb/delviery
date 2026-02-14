/**
 * Vendor Forms Integration Tests
 * Tests that the form libraries (react-hook-form, zod, @hookform/resolvers) work correctly
 * This ensures the chunk splitting doesn't break functionality
 */

import { describe, it, expect } from 'vitest';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Test schema
const testSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.number().min(18, 'Must be at least 18 years old').optional(),
});

type TestFormData = z.infer<typeof testSchema>;

// Test component
function TestForm({ onSubmit }: { onSubmit: (data: TestFormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input
          {...register('email')}
          type="email"
          placeholder="Email"
          data-testid="email-input"
        />
        {errors.email && <span data-testid="email-error">{errors.email.message}</span>}
      </div>

      <div>
        <input
          {...register('password')}
          type="password"
          placeholder="Password"
          data-testid="password-input"
        />
        {errors.password && <span data-testid="password-error">{errors.password.message}</span>}
      </div>

      <button type="submit" data-testid="submit-button">
        Submit
      </button>
    </form>
  );
}

describe('Vendor Forms Integration', () => {
  describe('react-hook-form functionality', () => {
    it('should import react-hook-form without errors', () => {
      expect(useForm).toBeDefined();
      expect(typeof useForm).toBe('function');
    });
  });

  describe('zod functionality', () => {
    it('should import zod without errors', () => {
      expect(z).toBeDefined();
      expect(z.string).toBeDefined();
      expect(z.object).toBeDefined();
    });

    it('should create and validate schemas', () => {
      const schema = z.object({
        name: z.string(),
      });

      const validData = { name: 'John' };
      const invalidData = { name: 123 };

      expect(schema.safeParse(validData).success).toBe(true);
      expect(schema.safeParse(invalidData).success).toBe(false);
    });

    it('should validate email format', () => {
      const emailSchema = z.string().email();

      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
      expect(emailSchema.safeParse('invalid-email').success).toBe(false);
    });

    it('should validate string length', () => {
      const passwordSchema = z.string().min(8);

      expect(passwordSchema.safeParse('12345678').success).toBe(true);
      expect(passwordSchema.safeParse('1234567').success).toBe(false);
    });

    it('should validate numbers', () => {
      const ageSchema = z.number().min(18);

      expect(ageSchema.safeParse(18).success).toBe(true);
      expect(ageSchema.safeParse(25).success).toBe(true);
      expect(ageSchema.safeParse(17).success).toBe(false);
    });
  });

  describe('@hookform/resolvers functionality', () => {
    it('should import zodResolver without errors', () => {
      expect(zodResolver).toBeDefined();
      expect(typeof zodResolver).toBe('function');
    });

    it('should integrate zod with react-hook-form', () => {
      const schema = z.object({ name: z.string() });
      const resolver = zodResolver(schema);
      expect(resolver).toBeDefined();
    });
  });

  describe('full integration test', () => {
    it('should render form with react-hook-form and zod validation', async () => {
      const onSubmit = vi.fn();
      render(<TestForm onSubmit={onSubmit} />);

      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    it('should show validation errors on invalid input', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<TestForm onSubmit={onSubmit} />);

      // Try to submit empty form
      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toBeInTheDocument();
        expect(screen.getByTestId('password-error')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should validate password length', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<TestForm onSubmit={onSubmit} />);

      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'short');
      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent(
          'Password must be at least 8 characters'
        );
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('advanced zod features', () => {
    it('should handle optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      expect(schema.safeParse({ required: 'value' }).success).toBe(true);
      expect(schema.safeParse({ required: 'value', optional: 'also value' }).success).toBe(true);
    });

    it('should handle default values', () => {
      const schema = z.object({
        name: z.string().default('Anonymous'),
      });

      const result = schema.parse({});
      expect(result.name).toBe('Anonymous');
    });

    it('should handle transforms', () => {
      const schema = z.object({
        age: z.string().transform((val) => parseInt(val, 10)),
      });

      const result = schema.parse({ age: '25' });
      expect(result.age).toBe(25);
      expect(typeof result.age).toBe('number');
    });

    it('should handle nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      });

      const validData = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      };

      expect(schema.safeParse(validData).success).toBe(true);
    });

    it('should handle arrays', () => {
      const schema = z.object({
        tags: z.array(z.string()).min(1),
      });

      expect(schema.safeParse({ tags: ['tag1', 'tag2'] }).success).toBe(true);
      expect(schema.safeParse({ tags: [] }).success).toBe(false);
    });

    it('should handle enums', () => {
      const schema = z.object({
        role: z.enum(['admin', 'user', 'guest']),
      });

      expect(schema.safeParse({ role: 'admin' }).success).toBe(true);
      expect(schema.safeParse({ role: 'invalid' }).success).toBe(false);
    });
  });
});
