// Hidden page that keeps the backup AI loaded while Chrome is open. The side panel is closed and
// reopened often, and starting the model takes ~15 s; this page lives until Chrome quits, so the
// model starts once per Chrome session instead of every time the panel opens.
// The side panel talks to it through a port named 'ai' (see ai/fallback.ts).

const worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' })
// Extensions may not load code from the internet, so use the runtime files shipped in /ort.
const wasmPaths = {
  mjs: chrome.runtime.getURL('ort/ort-wasm-simd-threaded.asyncify.mjs'),
  wasm: chrome.runtime.getURL('ort/ort-wasm-simd-threaded.asyncify.wasm'),
}
let nextId = 0
let loading = '' // latest "Preparing the AI… 34%" message while the model loads; '' once loaded
const ports = new Set<chrome.runtime.Port>()

const send = (port: chrome.runtime.Port, msg: object) => {
  try {
    port.postMessage(msg)
  } catch {} // the panel was closed meanwhile
}

// Loading progress goes to every open panel, also ones opened after the load began.
worker.addEventListener('message', (e: MessageEvent) => {
  if (!e.data.loading) return
  loading = e.data.loading
  for (const p of ports) send(p, { progress: loading })
})

function run(query: string, device: string | undefined, dtype: string | undefined, onProgress: (m: string) => void) {
  const id = nextId++
  return new Promise<string>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data.id !== id) return
      if (e.data.progress) return onProgress(e.data.progress)
      worker.removeEventListener('message', onMessage)
      if (e.data.error) return reject(new Error(e.data.error))
      loading = ''
      resolve(e.data.reply)
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ id, query, wasmPaths, device, dtype })
  })
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai') return
  ports.add(port)
  port.onDisconnect.addListener(() => ports.delete(port))
  if (loading) send(port, { progress: loading })
  port.onMessage.addListener(({ query, device, dtype }) => {
    run(query, device, dtype, (m) => send(port, { progress: m })).then(
      (reply) => send(port, { reply }),
      (err) => send(port, { error: String((err as Error)?.message ?? err) }),
    )
  })
})

// Opened at Chrome startup (?preload): load the model now, unless Chrome's Gemini Nano will be used.
if (new URLSearchParams(location.search).has('preload')) {
  const nano = typeof LanguageModel === 'undefined' ? Promise.resolve('') : LanguageModel.availability().catch(() => '')
  nano.then((n) => {
    if (n !== 'available') run('', undefined, undefined, () => {}).catch((e) => console.warn('[ai] startup load failed:', e))
  })
}
