declare module 'gifenc' {
  export type Palette = number[][];
  export interface QuantizeOptions {
    format?: 'rgb565' | 'rgb444' | 'rgba4444';
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  }
  export interface WriteFrameOptions {
    palette?: Palette;
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
    first?: boolean;
  }
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: QuantizeOptions): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: QuantizeOptions['format']): Uint8Array;
}

declare module 'gifuct-js' {
  export interface ParsedGif {
    lsd: { width: number; height: number };
  }
  export interface ParsedFrame {
    dims: { width: number; height: number; top: number; left: number };
    delay: number;
    disposalType: number;
    patch: Uint8ClampedArray;
  }
  export function parseGIF(buffer: ArrayBuffer): ParsedGif;
  export function decompressFrames(gif: ParsedGif, buildImagePatches: boolean): ParsedFrame[];
}
