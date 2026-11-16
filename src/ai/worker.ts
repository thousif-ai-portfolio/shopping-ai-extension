// Runs the backup model off the main thread so the side panel never freezes.
// Messages in:  { id, wasmPaths, device?, dtype?, query? }   (no query = just preload the model)
// Messages out: { id, progress } | { id, reply } | { id, error } | { loading } (to every panel)
import { env, pipeline, type TextGenerationPipeline } from '@huggingface/transformers'
// A tiny answer like "black, puma" is much faster than generating JSON (see prompt.ts).
import { EXAMPLE_IN, EXAMPLE_OUT, SYSTEM } from './prompt'

const MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct'

let generator: Promise<TextGenerationPipeline> | null = null

// Loading progress has no request id: every open panel shows it (see offscreen/main.ts).
const progress = (msg: string) => self.postMessage({ loading: msg })

let loadedAs = '' // device/dtype of the loaded model; the speed test asks for others

// CPU with the 8-bit model was fastest in tests on a typical laptop (i3, Intel graphics):
// 18 s per answer vs 20-36 s for other options, and loads in seconds instead of ~90 s on GPU.
// Stronger PCs usually get Chrome's Gemini Nano instead of this backup.
function load(device = 'wasm', dtype = 'q8') {
  const as = `${device}/${dtype}`
  if (as !== loadedAs) generator = null
  loadedAs = as
  generator ??= (async () => {
    progress('Preparing the AI…')
    const t0 = performance.now()
    const gen = (await pipeline('text-generation', MODEL, {
      device: device as 'webgpu' | 'wasm',
      dtype: dtype as 'q8',
      // The model file (~500 MB) is downloaded the first time and read from the browser's cache
      // after that; either way it then has to start up, which takes about 15 s on a laptop.
      progress_callback: (p: any) => {
        if (!p.file?.endsWith('.onnx')) return
        if (p.status === 'progress') progress(`Preparing the AI… ${Math.round(p.progress ?? 0)}%`)
        if (p.status === 'done') progress('Starting the AI… (about 15 seconds)')
      },
    })) as TextGenerationPipeline
    // A tiny practice run makes the GPU prepare its programs now, not on the first real request.
    if (device === 'webgpu') await gen('hi', { max_new_tokens: 1 })
    console.log(
      `[ai] model (${dtype}) loaded on ${device} in ${Math.round(performance.now() - t0)} ms` +
        ` (threads: ${self.crossOriginIsolated ? env.backends.onnx.wasm!.numThreads ?? 'auto' : 1})`,
    )
    return gen
  })()
  generator.catch(() => (generator = null)) // allow a retry after a failed download
  return generator
}

self.onmessage = async (e: MessageEvent) => {
  const { id, query, wasmPaths, device, dtype } = e.data
  try {
    env.backends.onnx.wasm!.wasmPaths = wasmPaths
    // Otherwise it re-loads the runtime from a blob: URL, which extension security rules block.
    env.useWasmCache = false
    const gen = await load(device, dtype)
    if (!query) return self.postMessage({ id, reply: '' })
    self.postMessage({ id, progress: 'AI is reading your request…' })
    const t0 = performance.now()
    const out = await gen(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: EXAMPLE_IN },
        { role: 'assistant', content: EXAMPLE_OUT },
        { role: 'user', content: query },
      ],
      { max_new_tokens: 20, do_sample: false },
    )
    console.log(`[ai] answered in ${Math.round(performance.now() - t0)} ms`)
    self.postMessage({ id, reply: (out[0] as any).generated_text.at(-1).content })
  } catch (err) {
    self.postMessage({ id, error: String((err as Error)?.message ?? err) })
  }
}
