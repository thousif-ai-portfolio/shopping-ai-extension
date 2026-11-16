// Backup on-device AI for PCs where Chrome's Gemini Nano is unavailable.
// A small open model (Qwen2.5-0.5B-Instruct) runs with Transformers.js inside a Web Worker
// (worker.ts). The worker lives in a hidden page (offscreen/main.ts) that stays open while Chrome
// runs, so closing and reopening the panel doesn't restart the model. Downloaded once (~500 MB).
let aiPage: Promise<unknown> | null = null

/** The backup model's answer: the descriptive words, comma-separated. */
export async function askBackup(query: string, onProgress: (msg: string) => void): Promise<string> {
  // The background script opens the hidden AI page if it isn't open yet.
  aiPage ??= chrome.runtime.sendMessage('ensure-ai').then((r) => {
    if (r !== true) throw new Error(String(r))
  })
  aiPage.catch(() => (aiPage = null)) // retry next time
  await aiPage
  // ?device=wasm|webgpu and ?dtype=q4|q8|q4f16 override the defaults (used by the speed test).
  const params = new URLSearchParams(location.search)
  const device = params.get('device') ?? undefined
  const dtype = params.get('dtype') ?? undefined
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'ai' })
    port.onMessage.addListener((m) => {
      if (m.progress) return onProgress(m.progress)
      port.disconnect()
      if (m.error) reject(new Error(m.error))
      else resolve(m.reply)
    })
    port.onDisconnect.addListener(() => reject(new Error('the background AI page closed')))
    port.postMessage({ query, device, dtype })
  })
}

/** Starts loading the model in the background so it's ready by the time the user asks. */
export function preload(onProgress: (msg: string) => void) {
  return askBackup('', onProgress)
}

