import React, { useEffect, useState } from 'react'

import { getFraudClaims, reviewClaim } from '../api.js'
import { useAuth } from '../App.jsx'

export default function FraudReviewPage() {
  const { user } = useAuth()
  const [claims, setClaims] = useState([])
  const [selected, setSelected] = useState(null)
  const [reviewNote, setReviewNote] = useState('')

  const load = async () => {
    const res = await getFraudClaims()
    setClaims(res.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const submitReview = async (action) => {
    if (!selected) return
    await reviewClaim({
      claim_id: selected.claim_id,
      action,
      review_note: reviewNote,
      reviewed_by: user.user_id
    })
    setSelected(null)
    setReviewNote('')
    load()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">Fraud review queue</h1>
        <p className="mt-1 text-sm text-slate-500">Review GPS mismatch, weather mismatch, duplicate claims, and abnormal claim frequency.</p>
        <div className="mt-4 space-y-3">
          {claims.map((claim) => (
            <button
              key={claim.claim_id}
              onClick={() => setSelected(claim)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selected?.claim_id === claim.claim_id ? 'border-rose-300 bg-rose-50' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{claim.user_name}</p>
                  <p className="text-sm text-slate-500">{claim.city} - {claim.trigger_event}</p>
                </div>
                <p className="text-xl font-black text-rose-600">{Math.round(claim.fraud_score * 100)}%</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {!selected ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">Select a flagged claim to review evidence.</div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Claim #{selected.claim_id}</h2>
              <p className="text-sm text-slate-500">{selected.user_name} - {selected.user_role} - {selected.city}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card label="Fraud score" value={`${Math.round(selected.fraud_score * 100)}%`} />
              <Card label="Payout exposure" value={`Rs ${Math.round(selected.payout_amount)}`} />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Evidence</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(selected.fraud_reasons || []).map((reason) => <li key={reason}>- {reason}</li>)}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Review note</p>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={5}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500"
                placeholder="Add investigation outcome, supporting rationale, or escalation detail"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => submitReview('approved')} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
                Approve claim
              </button>
              <button onClick={() => submitReview('rejected')} className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white">
                Reject claim
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  )
}
