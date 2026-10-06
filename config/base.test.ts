import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE, normalizeBase } from './base';

describe('normalizeBase（VITE_BASE）', () => {
  it('未設定時維持 GitHub Pages 路徑', () => {
    expect(normalizeBase(undefined)).toBe(DEFAULT_BASE);
    expect(normalizeBase('  ')).toBe('/happybigbomb/');
  });
  it('支援相對路徑', () => {
    expect(normalizeBase('./')).toBe('./');
    expect(normalizeBase('.')).toBe('./');
  });
  it('補齊開頭與結尾的斜線', () => {
    expect(normalizeBase('tools/collage')).toBe('/tools/collage/');
    expect(normalizeBase('/')).toBe('/');
  });
  it('完整網址補上結尾斜線', () => {
    expect(normalizeBase('https://cdn.example.com/app')).toBe('https://cdn.example.com/app/');
  });
});
