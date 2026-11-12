import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';
import { SearchInput } from './SearchInput';

describe('Input component', () => {
  it('renders with default size (md = 56px, p-4)', () => {
    render(<Input placeholder="Enter text" />);
    const inp = screen.getByPlaceholderText(/enter text/i);
    expect(inp.className).toContain('h-14');
    expect(inp.className).toContain('py-4');
    expect(inp.className).toContain('rounded-lg');
  });

  it('renders sm size (48px = h-12, p-3)', () => {
    render(<Input size="sm" placeholder="Small input" />);
    const inp = screen.getByPlaceholderText(/small input/i);
    expect(inp.className).toContain('h-12');
    expect(inp.className).toContain('py-3');
    expect(inp.className).toContain('rounded-lg');
  });

  it('renders lg size (64px = h-16, p-5)', () => {
    render(<Input size="lg" placeholder="Large input" />);
    const inp = screen.getByPlaceholderText(/large input/i);
    expect(inp.className).toContain('h-16');
    expect(inp.className).toContain('py-5');
  });

  it('renders error message and sets aria-invalid and role alert', () => {
    render(<Input placeholder="Error input" error="Invalid email address" />);
    const inp = screen.getByPlaceholderText(/error input/i);
    expect(inp).toHaveAttribute('aria-invalid', 'true');
    expect(inp.className).toContain('border-red-500');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid email address');
  });

  it('renders boolean error flag without message text', () => {
    render(<Input placeholder="Flag error" error={true} />);
    const inp = screen.getByPlaceholderText(/flag error/i);
    expect(inp).toHaveAttribute('aria-invalid', 'true');
    expect(inp.className).toContain('border-red-500');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders helper text when no error, and replaces it with error when error exists', () => {
    const { rerender } = render(<Input placeholder="Test" helperText="Must be 8+ characters" />);
    expect(screen.getByText('Must be 8+ characters')).toBeInTheDocument();

    rerender(<Input placeholder="Test" helperText="Must be 8+ characters" error="Too short" />);
    expect(screen.queryByText('Must be 8+ characters')).not.toBeInTheDocument();
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });

  it('renders label with required asterisk', () => {
    render(<Input label="Username" required placeholder="User" />);
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('applies animate-shake when shake is true', () => {
    const { container } = render(<Input placeholder="Shake test" shake error="Error" />);
    expect(container.firstChild).toHaveClass('animate-shake');
  });
});

describe('SearchInput component', () => {
  it('renders search input with clear button when value is set', () => {
    render(<SearchInput value="test" onChange={() => {}} placeholder="Search..." />);
    const inp = screen.getByPlaceholderText(/search.../i);
    expect(inp).toHaveValue('test');
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });
});
