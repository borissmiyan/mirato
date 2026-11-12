import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';

describe('Card Component', () => {
  it('renders children correctly with default styling', () => {
    render(<Card>Card Body</Card>);
    const card = screen.getByText('Card Body');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('p-6'); // Default padding md is p-6 (24px)
    expect(card).toHaveClass('rounded-xl');
  });

  it('applies padding variants correctly based on 4/8 spacing grid', () => {
    const { rerender } = render(<Card padding="none">None</Card>);
    expect(screen.getByText('None')).toHaveClass('p-0');

    rerender(<Card padding="sm">Small</Card>);
    expect(screen.getByText('Small')).toHaveClass('p-4');

    rerender(<Card padding="md">Medium</Card>);
    expect(screen.getByText('Medium')).toHaveClass('p-6');

    rerender(<Card padding="lg">Large</Card>);
    expect(screen.getByText('Large')).toHaveClass('p-8');
  });

  it('renders compound subcomponents with correct structure', () => {
    render(
      <Card padding="none">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>Content Area</CardContent>
        <CardFooter>Footer Area</CardFooter>
      </Card>
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card Description')).toBeInTheDocument();
    expect(screen.getByText('Content Area')).toBeInTheDocument();
    expect(screen.getByText('Footer Area')).toBeInTheDocument();
  });

  it('applies interactive hover and cursor styles when interactive is true', () => {
    render(<Card interactive>Clickable Card</Card>);
    const card = screen.getByText('Clickable Card');
    expect(card).toHaveClass('cursor-pointer');
    expect(card).toHaveClass('hover:border-white/20');
  });
});
