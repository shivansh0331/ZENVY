// ============================================================
// LanguageSelector.jsx — Language Selection Dropdown
// ============================================================

import React from 'react'
import { useI18n } from '../i18n.jsx'

export default function LanguageSelector({ minimal = false }) {
  const { lang, setLang, t, LANGUAGES } = useI18n()

  if (minimal) {
    return (
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="text-xs bg-transparent border-0 text-blue-600 font-semibold cursor-pointer focus:outline-none"
      >
        {Object.entries(LANGUAGES).map(([code, { name, flag }]) => (
          <option key={code} value={code}>
            {flag} {name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="relative">
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-all"
      >
        {Object.entries(LANGUAGES).map(([code, { name, flag }]) => (
          <option key={code} value={code}>
            {flag} {name}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}