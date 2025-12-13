'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Copy, Check, Bookmark, Smartphone, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

export default function QuickSavePage() {
  const { user, token } = useAuth()
  const [copied, setCopied] = useState<string | null>(null)
  const [showBookmarkletInstructions, setShowBookmarkletInstructions] = useState(false)
  const [showShortcutInstructions, setShowShortcutInstructions] = useState(false)

  // Hardcoded API URL - env vars broken in Railway
  const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://knowledge-base-ai-production.up.railway.app'
    : 'http://localhost:8000'
  const FRONTEND_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

  // Bookmarklet code - token is embedded directly (personalized per user)
  // This is necessary because localStorage is domain-specific
  const bookmarkletCode = token ? `javascript:(function(){var t='${token}';var u=encodeURIComponent(location.href);var p=window.open('','kbase','width=420,height=320');p.document.write('<html><head><title>Saving...</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,rgb(249 250 251) 0%,rgb(243 244 246) 100%)}.card{background:white;padding:2rem;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);text-align:center;max-width:320px}.spinner{width:48px;height:48px;border:4px solid rgb(229 231 235);border-top-color:rgb(59 130 246);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem}@keyframes spin{to{transform:rotate(360deg)}}h2{margin:0 0 0.5rem;color:rgb(17 24 39);font-size:1.25rem}p{margin:0;color:rgb(107 114 128);font-size:0.875rem}</style></head><body><div class="card"><div class="spinner"></div><h2>Saving to Knowledge Base</h2><p>Processing your content...</p></div></body></html>');fetch('${API_URL}/api/v1/quick-save/',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({url:decodeURIComponent(u)})}).then(r=>r.json()).then(d=>{if(d.success){p.document.body.innerHTML='<div class="card"><div style="width:48px;height:48px;background:rgb(34 197 94);border-radius:50%;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center"><svg width="24" height="24" fill="none" stroke="white" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg></div><h2>Saved!</h2><p style="color:rgb(17 24 39);font-weight:500;margin-bottom:0.5rem">'+d.title.substring(0,60)+(d.title.length>60?'...':'')+'</p><button onclick="window.close()" style="margin-top:1rem;background:rgb(59 130 246);color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;font-size:0.875rem;cursor:pointer;font-weight:500">Close</button></div>';}else{p.document.body.innerHTML='<div class="card"><div style="width:48px;height:48px;background:rgb(239 68 68);border-radius:50%;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center"><svg width="24" height="24" fill="none" stroke="white" stroke-width="3"><path d="M6 6l12 12M6 18L18 6"/></svg></div><h2>Error</h2><p>'+d.message+'</p><button onclick="window.close()" style="margin-top:1rem;background:rgb(107 114 128);color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;font-size:0.875rem;cursor:pointer;font-weight:500">Close</button></div>';}}).catch(e=>{p.document.body.innerHTML='<div class="card"><div style="width:48px;height:48px;background:rgb(239 68 68);border-radius:50%;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center"><svg width="24" height="24" fill="none" stroke="white" stroke-width="3"><path d="M6 6l12 12M6 18L18 6"/></svg></div><h2>Error</h2><p>Connection failed. Please try again.</p><button onclick="window.close()" style="margin-top:1rem;background:rgb(107 114 128);color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;font-size:0.875rem;cursor:pointer;font-weight:500">Close</button></div>';});})();` : ''

  // iOS Shortcut URL (opens Shortcuts app to create)
  const shortcutCallbackUrl = `${API_URL}/api/v1/quick-save/callback`

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Bookmark className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quick Save Setup</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Please login to set up quick save for your browser and iOS device.
          </p>
          <a
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Login to Continue
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Quick Save Setup
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Save any webpage to your Knowledge Base with one click from your browser or iOS device.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Bookmarklet Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
              <Bookmark className="w-12 h-12 text-white mb-3" />
              <h2 className="text-2xl font-bold text-white">Browser Bookmarklet</h2>
              <p className="text-blue-100 mt-1">For desktop browsers (Chrome, Safari, Firefox)</p>
            </div>

            <div className="p-6">
              {!token ? (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                  <p className="text-amber-800 dark:text-amber-200 text-sm">
                    Loading your personalized bookmarklet...
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                    <p className="text-green-800 dark:text-green-200 text-xs mb-1">
                      <strong>API URL:</strong> <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{API_URL}</code>
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-xs">
                      Si cambiaste de servidor (ej: de localhost a producción), debes arrastrar este bookmarklet de nuevo.
                    </p>
                  </div>
                  <div className="mb-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                    <p className="text-amber-800 dark:text-amber-200 text-xs">
                      <strong>Note:</strong> This bookmarklet contains your personal token. If it stops working, come back here to get a new one.
                    </p>
                  </div>
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Quick Setup:</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                      Drag this button to your bookmarks bar:
                    </p>
                    <a
                      href={bookmarkletCode}
                      onClick={(e) => e.preventDefault()}
                      draggable="true"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition cursor-grab active:cursor-grabbing"
                    >
                      <Bookmark className="w-5 h-5" />
                      Save to KBase
                    </a>
                  </div>
                </>
              )}

              <button
                onClick={() => setShowBookmarkletInstructions(!showBookmarkletInstructions)}
                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-sm"
              >
                {showBookmarkletInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showBookmarkletInstructions ? 'Hide' : 'Show'} detailed instructions
              </button>

              {showBookmarkletInstructions && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span>Show your bookmarks bar (Cmd+Shift+B on Mac, Ctrl+Shift+B on Windows)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span>Drag the "Save to KBase" button above to your bookmarks bar</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <span>When on any webpage, click the bookmark to save it!</span>
                    </li>
                  </ol>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Or copy the code manually:</p>
                    <div className="relative">
                      <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto max-h-20 text-gray-700 dark:text-gray-300">
                        {bookmarkletCode.substring(0, 100)}...
                      </code>
                      <button
                        onClick={() => copyToClipboard(bookmarkletCode, 'bookmarklet')}
                        className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-700 rounded shadow hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        {copied === 'bookmarklet' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* iOS Shortcut Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6">
              <Smartphone className="w-12 h-12 text-white mb-3" />
              <h2 className="text-2xl font-bold text-white">iOS Shortcut</h2>
              <p className="text-purple-100 mt-1">For iPhone and iPad Share Sheet</p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Setup Instructions:</h3>

                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>API URL base:</strong>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded text-xs overflow-x-auto text-gray-700 dark:text-gray-300">
                      {shortcutCallbackUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(shortcutCallbackUrl, 'apiurl')}
                      className="p-2 bg-white dark:bg-gray-700 rounded shadow hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      {copied === 'apiurl' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Your access token:</strong>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded text-xs overflow-x-auto text-gray-700 dark:text-gray-300">
                      {token ? `${token.substring(0, 20)}...` : 'Loading...'}
                    </code>
                    <button
                      onClick={() => token && copyToClipboard(token, 'token')}
                      className="p-2 bg-white dark:bg-gray-700 rounded shadow hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      {copied === 'token' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-2">
                    Copy this token - you'll need it for the Shortcut
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowShortcutInstructions(!showShortcutInstructions)}
                className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium text-sm"
              >
                {showShortcutInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showShortcutInstructions ? 'Hide' : 'Show'} setup instructions
              </button>

              {showShortcutInstructions && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <ol className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span>Open the <strong>Shortcuts</strong> app on your iPhone/iPad</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span>Tap <strong>+</strong> to create a new Shortcut</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <div>
                        <span>Add action: <strong>Get URLs from Input</strong></span>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <div>
                        <span>Add action: <strong>URL</strong> with this value:</span>
                        <div className="mt-2 relative">
                          <code className="block bg-white dark:bg-gray-800 p-2 rounded text-xs break-all text-gray-700 dark:text-gray-300">
                            {shortcutCallbackUrl}?url=[URLs]&token=YOUR_TOKEN
                          </code>
                          <button
                            onClick={() => copyToClipboard(`${shortcutCallbackUrl}?url=`, 'callback')}
                            className="absolute top-1 right-1 p-1 bg-gray-100 dark:bg-gray-600 rounded"
                          >
                            {copied === 'callback' ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-500" />
                            )}
                          </button>
                        </div>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                      <span>Add action: <strong>Get Contents of URL</strong></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">6</span>
                      <span>Add action: <strong>Show Result</strong></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">7</span>
                      <span>Tap the settings icon, enable <strong>"Show in Share Sheet"</strong></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">8</span>
                      <span>Name it <strong>"Save to KBase"</strong> and save</span>
                    </li>
                  </ol>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Now when you tap Share in Safari or any app, you'll see "Save to KBase" as an option!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Test Section */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            Test Your Setup
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
            Try saving this test URL to make sure everything works:
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Open example.com
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
