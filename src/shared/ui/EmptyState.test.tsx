import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import { Search } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title and description correctly', () => {
    render(
      <EmptyState
        title="No Results Found"
        description="Try searching for something else"
      />
    );
    expect(screen.getByText('No Results Found')).toBeInTheDocument();
    expect(screen.getByText('Try searching for something else')).toBeInTheDocument();
  });

  it('renders action button and icon component', () => {
    render(
      <EmptyState
        icon={Search}
        title="Empty"
        action={<button>Create Item</button>}
      />
    );
    expect(screen.getByText('Create Item')).toBeInTheDocument();
  });
});
