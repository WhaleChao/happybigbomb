/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 允許接收高度訊息的父頁面 origin，例如 https://tools.example.com */
  readonly VITE_EMBED_PARENT_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
