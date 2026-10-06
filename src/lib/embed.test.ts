import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEIGHT_MESSAGE_TYPE, embedTargetOrigin, normalizeOrigin, readEmbedParams, startHeightReporter } from './embed';

describe('readEmbedParams', () => {
  it('解析 embed、parentOrigin、theme', () => {
    expect(readEmbedParams('?embed=1&parentOrigin=https://a.example.com/path&theme=dark')).toEqual({
      embed: true,
      parentOrigin: 'https://a.example.com',
      theme: 'dark',
    });
  });
  it('embed=0 代表強制關閉，沒有參數代表自動偵測', () => {
    expect(readEmbedParams('?embed=0').embed).toBe(false);
    expect(readEmbedParams('').embed).toBeNull();
  });
  it('不合法的 theme 忽略', () => {
    expect(readEmbedParams('?theme=pink').theme).toBeNull();
  });
});

describe('normalizeOrigin', () => {
  it('只接受 http(s)', () => {
    expect(normalizeOrigin('javascript:alert(1)')).toBeNull();
    expect(normalizeOrigin('not a url')).toBeNull();
    expect(normalizeOrigin('http://localhost:5173/x')).toBe('http://localhost:5173');
  });
});

describe('embedTargetOrigin', () => {
  it('未指定時使用 *（訊息只有高度數字，不含任何使用者資料）', () => {
    expect(embedTargetOrigin('')).toBe('*');
  });
  it('網址參數優先', () => {
    expect(embedTargetOrigin('?parentOrigin=https://host.example')).toBe('https://host.example');
  });
});

describe('startHeightReporter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('以 postMessage 回報內容高度，相同高度不重複送出', () => {
    let roCallback: () => void = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          roCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const root = document.createElement('div');
    Object.defineProperty(root, 'scrollHeight', { value: 812.4, configurable: true });
    const target = { postMessage: vi.fn() } as unknown as Window;

    const stop = startHeightReporter(target, 'https://host.example', root);
    expect(target.postMessage).toHaveBeenCalledWith({ type: HEIGHT_MESSAGE_TYPE, height: 813 }, 'https://host.example');
    roCallback();
    expect(target.postMessage).toHaveBeenCalledTimes(1);
    Object.defineProperty(root, 'scrollHeight', { value: 900, configurable: true });
    roCallback();
    expect(target.postMessage).toHaveBeenLastCalledWith({ type: HEIGHT_MESSAGE_TYPE, height: 900 }, 'https://host.example');
    stop();
  });
});
