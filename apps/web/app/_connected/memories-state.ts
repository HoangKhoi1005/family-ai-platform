import type { MemoryDto } from '@family/contracts';

export type MemoriesState = {
  familyId: string;
  memories: MemoryDto[];
  cursor: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
};

export type MemoriesAction =
  | { type: 'reset'; familyId: string }
  | { type: 'loading' }
  | { type: 'failed'; error: string }
  | {
      type: 'loaded';
      familyId: string;
      memories: MemoryDto[];
      cursor: string | null;
      append: boolean;
    }
  | { type: 'upsert'; memory: MemoryDto };

export function createMemoriesState(familyId = ''): MemoriesState {
  return { familyId, memories: [], cursor: null, status: 'idle', error: '' };
}

function unique(memories: MemoryDto[]): MemoryDto[] {
  return [...new Map(memories.map((memory) => [memory.id, memory])).values()];
}

export function memoriesReducer(state: MemoriesState, action: MemoriesAction): MemoriesState {
  switch (action.type) {
    case 'reset':
      return createMemoriesState(action.familyId);
    case 'loading':
      return { ...state, status: 'loading', error: '' };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'loaded':
      if (action.familyId !== state.familyId) return state;
      return {
        ...state,
        memories: unique(action.append ? [...state.memories, ...action.memories] : action.memories),
        cursor: action.cursor,
        status: 'ready',
        error: '',
      };
    case 'upsert':
      return {
        ...state,
        memories: unique([
          action.memory,
          ...state.memories.filter((memory) => memory.id !== action.memory.id),
        ]),
        status: 'ready',
      };
  }
}
