import { describe, expect, it } from 'vitest';
import type { MomentDto } from '@family/contracts';
import { createMomentsState, momentsReducer } from './moments-state.js';

const moment = { id: 'm1', my_reaction: null } as MomentDto;

describe('momentsReducer', () => {
  it('deduplicates load-more and clears data when family changes', () => {
    let state = createMomentsState('family-a');
    state = momentsReducer(state, {
      type: 'loaded',
      familyId: 'family-a',
      moments: [moment],
      cursor: 'next',
      append: false,
    });
    state = momentsReducer(state, {
      type: 'loaded',
      familyId: 'family-a',
      moments: [moment],
      cursor: null,
      append: true,
    });
    expect(state.moments).toHaveLength(1);
    expect(momentsReducer(state, { type: 'reset', familyId: 'family-b' }).moments).toEqual([]);
  });

  it('supports optimistic reaction rollback', () => {
    let state = { ...createMomentsState('family-a'), moments: [moment] };
    state = momentsReducer(state, { type: 'reaction', momentId: 'm1', reaction: 'thuong' });
    expect(state.moments[0]?.my_reaction).toBe('thuong');
    state = momentsReducer(state, { type: 'reaction', momentId: 'm1', reaction: null });
    expect(state.moments[0]?.my_reaction).toBeNull();
  });
});
