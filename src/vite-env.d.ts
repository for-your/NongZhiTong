/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 女娲 API 地址（本地开发默认 /nuwax-api 走 Vite 代理） */
  readonly VITE_NUWAX_BASE_URL?: string;
  /** 连接模式：demo（默认）或 real；真实凭据由同源网关读取 */
  readonly VITE_NUWAX_MODE?: 'demo' | 'real';
}
