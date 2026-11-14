// Backup on-device AI for PCs where Chrome's Gemini Nano is unavailable.
// A small open model (Qwen2.5-0.5B-Instruct) runs with Transformers.js inside a Web Worker
// (worker.ts), so the panel stays responsive. Downloaded once (~500 MB), then cached.
import type { Wanted } from './match'

let worker: Worker | null = null
let nextId = 0

function ask(query: string, onProgress: (msg: string) => void): Promise<string> {
  worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  const id = nextId++
  // Extensions may not load code from the internet, so use the runtime files shipped in /ort.
  const wasmPaths = {
    mjs: chrome.runtime.getURL('ort/ort-wasm-simd-threaded.asyncify.mjs'),
    wasm: chrome.runtime.getURL('ort/ort-wasm-simd-threaded.asyncify.wasm'),
  }
  // ?device=wasm|webgpu and ?dtype=q4|q8|q4f16 override the defaults (used by the speed test).
  const params = new URLSearchParams(location.search)
  const device = params.get('device') ?? undefined
  const dtype = params.get('dtype') ?? undefined
  return new Promise((resolve, reject) => {
    const w = worker!
    const onMessage = (e: MessageEvent) => {
      if (e.data.id !== id) return
      if (e.data.progress) return onProgress(e.data.progress)
      w.removeEventListener('message', onMessage)
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data.reply)
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ id, query, wasmPaths, device, dtype })
  })
}

/** Starts loading the model in the background so it's ready by the time the user asks. */
export function preload(onProgress: (msg: string) => void) {
  return ask('', onProgress)
}

export async function extractWanted(query: string, onProgress: (msg: string) => void): Promise<Wanted> {
  const reply = await ask(query, onProgress)
  return {
    terms: reply.split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
    max_price: null,
    min_price: null,
    min_discount: null,
    min_rating: null,
  }
}
