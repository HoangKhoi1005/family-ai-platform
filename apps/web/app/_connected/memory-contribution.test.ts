import type { MemoryDto } from '@family/contracts';
import { describe, expect, it } from 'vitest';
import { nextMemoryItemPosition, validateMemoryAudio } from './memory-contribution.js';

describe('Memory contribution rules', () => {
  it('uses the next open position in the server-supported 0..49 range', () => {
    expect(nextMemoryItemPosition({ items: [] } as unknown as MemoryDto)).toBe(0);
    expect(
      nextMemoryItemPosition({ items: [{ position: 2 }, { position: 0 }] } as unknown as MemoryDto),
    ).toBe(3);
    expect(
      nextMemoryItemPosition({ items: [{ position: 49 }] } as unknown as MemoryDto),
    ).toBeNull();
  });

  it('accepts supported private audio and rejects unsupported or oversized files', () => {
    expect(validateMemoryAudio({ type: 'audio/webm', size: 1024 })).toBe('');
    expect(validateMemoryAudio({ type: 'audio/wav', size: 1024 })).toContain('WebM');
    expect(validateMemoryAudio({ type: 'audio/mpeg', size: 25_000_001 })).toContain('25 MB');
  });
});
