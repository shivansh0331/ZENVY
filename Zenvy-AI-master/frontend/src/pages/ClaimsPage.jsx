// ============================================================
// ClaimsPage.jsx — File Manual Claim
// ============================================================

import React, { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { useI18n } from '../i18n.jsx'
import { getActivePolicy, fileClaim } from '../api.js'

export default function ClaimsPage() {
  const { user }   = useAuth()
  const { t }     = useI18n()
  const [policy, setPolicy]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]     = useState(null)
  const [description, setDesc]  = useState('')

  useEffect(() => {
    getActivePolicy(user.user_id)
      .then(r => setPolicy(r.data))
      .catch(() => setPolicy(null))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!policy) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fileClaim(user.user_id, {
        policy_id: policy.id,
        description,
        claim_type: 'manual'
      })
      setResult({ success: true, claim: res.data })
    } catch (e) {
      setResult({ success: false, error: e.response?.data?.detail || 'Claim failed' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">⏳ Loading...</div>

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800">📝 {t('fileClaim')}</h1>

      {!policy ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-bold text-orange-700">{t('noAlerts')}</p>
          <p className="text-orange-600 text-sm mt-1">You need an active policy to file a claim.</p>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
            <p className="font-medium text-blue-800">{t('myPolicy')} #{policy.id}</p>
            <p className="text-blue-600">{t('coverage')}: Rs{policy.coverage_amount.toLocaleString()} • {t('riskLevel')}: {policy.risk_level}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-1">{t('fileNewClaim')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Use this for disruptions not auto-triggered by weather. 
              4-layer fraud detection will run automatically.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('description')}
                </label>
                <textarea value={description} onChange={e => setDesc(e.target.value)}
                  rows={4} required
                  placeholder={t('describeIncident')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                <strong>Note:</strong> Claims go through 4-layer fraud detection:
                GPS verification · Duplicate check · Frequency analysis · Weather consistency
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                {submitting ? `⏳ ${t('processing')}` : `📤 ${t('submitClaim')}`}
              </button>
            </form>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-2xl p-6 border ${
              result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              {result.success ? (
                <>
                  <h3 className="font-bold text-green-800 text-lg mb-3">
                    {result.claim.fraud_flagged ? '⚠️ Claim Under Review' : '✅ Claim Approved & Paid!'}
                  </h3>
                  {!result.claim.fraud_flagged ? (
                    <div className="bg-white rounded-xl p-4 border border-green-200">
                      <p className="text-xs text-gray-500 mb-2 font-medium">💸 UPI PAYMENT RECEIPT</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">{t('payoutAmount')}</span><span className="font-bold text-green-700">Rs{result.claim.payout_amount.toFixed(0)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Transaction ID</span><span className="font-mono text-xs">{result.claim.upi_transaction_id}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{t('status')}</span><span className="font-bold text-green-600">✅ SUCCESS</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Via</span><span>ZENVY Insurance (Simulated UPI)</span></div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-orange-600 text-sm">Fraud score: {(result.claim.fraud_score * 100).toFixed(0)}%. Claim is under manual review.</p>
                  )}
                </>
              ) : (
                <p className="text-red-700 font-medium">⚠️ {result.error}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
