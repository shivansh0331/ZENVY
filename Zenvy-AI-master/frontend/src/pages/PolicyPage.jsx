import React, { useEffect, useState } from 'react'

import { useAuth } from '../App.jsx'
import { buyPolicy, getActivePolicy, getPolicyHistory, getWeatherRisk } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import { useI18n } from '../i18n.jsx'

export default function PolicyPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [weather, setWeather] = useState(null)
  const [policy, setPolicy] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [city, setCity] = useState(user?.city || 'Mumbai')
  const [showPayment, setShowPayment] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [weatherRes, historyRes] = await Promise.all([
          getWeatherRisk(city, user.role),
          getPolicyHistory(user.user_id)
        ])
        setWeather(weatherRes.data)
        setHistory(historyRes.data || [])
        try {
          const active = await getActivePolicy(user.user_id)
          setPolicy(active.data)
        } catch {
          setPolicy(null)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [city, user])

  const handlePaymentSuccess = async (paymentReceipt) => {
    try {
      await buyPolicy(user.user_id, {
        risk_score: weather.risk.risk_score,
        risk_level: weather.risk.risk_level,
        weekly_premium: weather.risk.weekly_premium,
        coverage_amount: 5000,
        payment_method: paymentReceipt.method,
        payment_reference: paymentReceipt.transaction_id
      })
      setMessage(`Policy purchased. Ref ${paymentReceipt.transaction_id}`)
      setShowPayment(false)
      const active = await getActivePolicy(user.user_id)
      setPolicy(active.data)
      const historyRes = await getPolicyHistory(user.user_id)
      setHistory(historyRes.data || [])
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Could not buy policy')
    }
  }

  if (loading) {
    return <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">Calculating your risk...</div>
  }

  const risk = weather?.risk
  const features = weather?.weather

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t('incomeInsurance')}</h1>
          <p className="text-sm text-slate-500">Buy weekly cover with simulated UPI checkout and policy activation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'].map((option) => (
            <button
              key={option}
              onClick={() => setCity(option)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                option === city ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">RADAR assessment</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{city}</h2>
            </div>
            {risk && <RiskBadge level={risk.risk_level} score={risk.risk_score} />}
          </div>

          {risk && (
            <>
              <div className="mt-6 rounded-3xl bg-slate-950 p-6 text-white">
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">Risk score</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-6xl font-black">{Math.round(risk.risk_score * 100)}%</p>
                  <div className="text-right">
                    <p className="text-sm text-white/60">{t('weeklyPremium')}</p>
                    <p className="text-3xl font-black">Rs {risk.weekly_premium}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                <Info label="Rainfall" value={`${features?.rainfall_mm?.toFixed(1)} mm`} />
                <Info label="AQI" value={`${features?.aqi?.toFixed(0)}`} />
                <Info label="Temperature" value={`${features?.temperature?.toFixed(0)} C`} />
                <Info label="Humidity" value={`${features?.humidity?.toFixed(0)} %`} />
                <Info label="Wind" value={`${features?.wind_speed?.toFixed(0)} km/h`} />
                <Info label="Coverage" value="Rs 5,000" />
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </div>
              )}

              {!policy ? (
                <button onClick={() => setShowPayment(true)} className="mt-5 w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white">
                  {t('buyPolicy')} - Rs {risk.weekly_premium}
                </button>
              ) : (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  Active policy in force. Payment ref: {policy.payment_reference || 'Recorded'}
                </div>
              )}
            </>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Active policy card</h3>
            {policy ? (
              <div className="mt-4 space-y-3">
                <Info label="Premium" value={`Rs ${policy.weekly_premium}/week`} />
                <Info label="Coverage" value={`Rs ${policy.coverage_amount}`} />
                <Info label="Risk level" value={policy.risk_level} />
                <Info label="Payment ref" value={policy.payment_reference || 'N/A'} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No active policy yet.</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">{t('policyHistory')}</h3>
            <div className="mt-4 space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{item.status}</p>
                      <p className="text-sm text-slate-500">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className="font-bold text-slate-900">Rs {item.weekly_premium}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={risk?.weekly_premium || 0}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}
