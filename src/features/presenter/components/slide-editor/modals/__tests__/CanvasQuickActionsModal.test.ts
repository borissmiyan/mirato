import { describe, it, expect } from 'vitest';
import { filterQuickActions, IQuickActionCommand } from '../quickActionsData';

describe('quickActionsData', () => {
  const sampleCommands: IQuickActionCommand[] = [
    { id: 'tool-select', title: 'Selection Tool', shortcut: 'V', category: 'Tools', action: () => {} },
    { id: 'tool-pen', title: 'Pen Tool', shortcut: 'P', category: 'Tools', action: () => {} },
    { id: 'tidy-up', title: 'Tidy Up Selection', shortcut: '⌥⇧⌘T', category: 'Layout', action: () => {} },
    { id: 'create-comp', title: 'Create Master Component', shortcut: '⌥⌘K', category: 'Components', action: () => {} },
  ];

  it('returns all commands when query is empty', () => {
    const results = filterQuickActions(sampleCommands, '');
    expect(results).toHaveLength(4);
  });

  it('filters commands by title query', () => {
    const results = filterQuickActions(sampleCommands, 'pen');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('tool-pen');
  });

  it('filters commands by category query', () => {
    const results = filterQuickActions(sampleCommands, 'component');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('create-comp');
  });

  it('is case-insensitive', () => {
    const results = filterQuickActions(sampleCommands, 'TIDY');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('tidy-up');
  });
});

