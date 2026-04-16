import React, { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { useI18n } from '../i18n.jsx'
import { getClaimsHistory } from '../api.js'

const STATUS_BADGE = {
  paid:    'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  flagged: 'bg-red-100 text-red-700',
  rejected:'bg-gray-100 text-gray-600',
}

const EVENT_LABELS = {
  rain_15mm: '🌧️ Rain (15mm+)',
  flood_40mm:'🌊 Flood (40mm+)',
  aqi_300:   '😷 AQI (300+)',
  heat_43:   '🌡️ Heat (43°C+)',
  manual_claim: '📝 Manual Claim',
  admin:     '🚨 Admin Trigger',
}

export default function PayoutHistory() {
  const { user }   = useAuth()
  const { t }     = useI18n()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClaimsHistory(user.user_id)
      .then(r => setClaims(r.data || []))
      .finally(() => setLoading(false))
  }, [])

  const totalPaid = claims.filter(c => c.status === 'paid').reduce((s, c) => s + c.payout_amount, 0)

  if (loading) return <div className="text-center py-12 text-gray-400">⏳ Loading payouts...</div>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">💸 {t('payoutHistory')}</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-green-600">Rs{totalPaid.toFixed(0)}</p>
          <p className="text-xs text-gray-500">{t('totalPayouts')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-blue-600">{claims.filter(c => c.status === 'paid').length}</p>
          <p className="text-xs text-gray-500">{t('approved')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-red-600">{claims.filter(c => c.fraud_flagged).length}</p>
          <p className="text-xs text-gray-500">{t('pending')}</p>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500">{t('noPayouts')}</p>
        </div>
      ) : (
        claims.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-gray-800">{EVENT_LABELS[c.trigger_event] || c.trigger_event}</p>
                <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[c.status] || STATUS_BADGE.pending}`}>
                  {c.status.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">{c.claim_type}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('payoutAmount')}</span>
              <span className="text-xl font-black text-green-600">Rs{c.payout_amount.toFixed(0)}</span>
            </div>

            {/* UPI Receipt */}
            {c.upi_receipt && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium mb-2">💳 UPI RECEIPT</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-gray-500">Txn ID:</span>
                  <span className="font-mono text-gray-700">{c.upi_receipt.transaction_id}</span>
                  <span className="text-gray-500">{t('status')}:</span>
                  <span className="font-bold text-green-600">{c.upi_receipt.status}</span>
                  <span className="text-gray-500">Bank:</span>
                  <span className="text-gray-600">{c.upi_receipt.bank}</span>
                  <span className="text-gray-500">{t('payoutDate')}:</span>
                  <span className="text-gray-600">{c.paid_at ? new Date(c.paid_at).toLocaleString() : '-'}</span>
                </div>
              </div>
            )}

            {c.fraud_flagged && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-2 text-xs text-red-600">
                ⚠️ Fraud score: {(c.fraud_score * 100).toFixed(0)}% — Under review
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
