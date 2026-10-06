import { describe, expect, it } from 'vitest';
import { detectKind } from './media';

describe('detectKind', () => {
  it.each([
    [{ type: 'image/jpeg', name: 'a.jpg' }, 'image'],
    [{ type: 'image/gif', name: 'a.gif' }, 'gif'],
    [{ type: '', name: 'ANIM.GIF' }, 'gif'],
    [{ type: 'video/mp4', name: 'a.mp4' }, 'video'],
    [{ type: '', name: 'clip.MOV' }, 'video'],
    [{ type: '', name: 'IMG_0001.HEIC' }, 'image'],
    [{ type: 'application/pdf', name: 'a.pdf' }, null],
  ] as const)('%o → %s', (file, kind) => {
    expect(detectKind(file)).toBe(kind);
  });
});
