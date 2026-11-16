// Clicking the extension icon opens the side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// The backup AI runs in a hidden page that stays open while Chrome runs (offscreen/main.ts).
let opening: Promise<void> | null = null
async function ensureAiPage(preload = false) {
  const open = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType] })
  if (open.length) return
  opening ??= chrome.offscreen
    .createDocument({
      url: 'src/offscreen/index.html' + (preload ? '?preload' : ''),
      reasons: ['WORKERS' as chrome.offscreen.Reason],
      justification: 'Keeps the on-device shopping AI loaded so the side panel is ready at once.',
    })
    .finally(() => (opening = null))
  await opening
}

// When Chrome starts, or the extension is installed or reloaded, load the AI in the background
// so it's ready before the panel is opened.
const preload = () => ensureAiPage(true).catch((e) => console.warn('[ai] could not open the AI page:', e))
chrome.runtime.onStartup.addListener(preload)
chrome.runtime.onInstalled.addListener(preload)

// The side panel asks for the AI page before its first AI request.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg !== 'ensure-ai') return
  ensureAiPage().then(
    () => reply(true),
    (e) => reply(String((e as Error)?.message ?? e)),
  )
  return true // reply comes later
})
