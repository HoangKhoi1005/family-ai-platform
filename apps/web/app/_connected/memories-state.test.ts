import { describe, expect, it } from 'vitest';
import type { MemoryDto } from '@family/contracts';
import { createMemoriesState, memoriesReducer } from './memories-state.js';

const memory = { id: 'memory-1' } as MemoryDto;

describe('memoriesReducer', () => {
  it('ignores stale family responses and deduplicates pages', () => {
    let state = createMemoriesState('family-b');
    state = memoriesReducer(state, {
      type: 'loaded',
      familyId: 'family-a',
      memories: [memory],
      cursor: null,
      append: false,
    });
    expect(state.memories).toEqual([]);
    state = memoriesReducer(state, {
      type: 'loaded',
      familyId: 'family-b',
      memories: [memory, memory],
      cursor: null,
      append: false,
    });
    expect(state.memories).toHaveLength(1);
  });
});
