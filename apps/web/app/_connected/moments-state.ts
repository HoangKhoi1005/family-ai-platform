import type { MomentDto, MomentReaction } from '@family/contracts';

export type MomentsState = {
  familyId: string;
  moments: MomentDto[];
  cursor: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
};

export type MomentsAction =
  | { type: 'reset'; familyId: string }
  | { type: 'loading' }
  | { type: 'failed'; error: string }
  | {
      type: 'loaded';
      familyId: string;
      moments: MomentDto[];
      cursor: string | null;
      append: boolean;
    }
  | { type: 'prepend'; moment: MomentDto }
  | { type: 'remove'; momentId: string }
  | { type: 'reaction'; momentId: string; reaction: MomentReaction | null };

export function createMomentsState(familyId = ''): MomentsState {
  return { familyId, moments: [], cursor: null, status: 'idle', error: '' };
}

function unique(moments: MomentDto[]): MomentDto[] {
  return [...new Map(moments.map((moment) => [moment.id, moment])).values()];
}

export function momentsReducer(state: MomentsState, action: MomentsAction): MomentsState {
  switch (action.type) {
    case 'reset':
      return createMomentsState(action.familyId);
    case 'loading':
      return { ...state, status: 'loading', error: '' };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'loaded':
      if (action.familyId !== state.familyId) return state;
      return {
        ...state,
        moments: unique(action.append ? [...state.moments, ...action.moments] : action.moments),
        cursor: action.cursor,
        status: 'ready',
        error: '',
      };
    case 'prepend':
      return { ...state, moments: unique([action.moment, ...state.moments]), status: 'ready' };
    case 'remove':
      return { ...state, moments: state.moments.filter((moment) => moment.id !== action.momentId) };
    case 'reaction':
      return {
        ...state,
        moments: state.moments.map((moment) =>
          moment.id === action.momentId ? { ...moment, my_reaction: action.reaction } : moment,
        ),
      };
  }
}
