import React, { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  getAdminAnalytics,
  getAdminPredictions,
  getAdminStats,
  getAllClaims,
  getFraudClaims,
  triggerEvent,
  reviewClaim
} from '../api.js'
import { useAuth } from '../App.jsx'

const PIE_COLORS = ['#ef4444', '#10b981']
const EVENT_OPTIONS = [
  'rain_15mm',
  'flood_40mm',
  'aqi_300',
  'heat_43',
  'platform_drop',
  'traffic',
  'curfew',
  'strike',
  'admin'
]

const TABS = [
  { id: 'analytics', label: 'Business Analytics', icon: '📊' },
  { id: 'predictions', label: 'Prediction AI', icon: '🧠' },
  { id: 'fraud', label: 'Fraud Review', icon: '🛡️' },
  { id: 'triggers', label: 'System Triggers', icon: '⚡' }
]

export default function AdminDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('analytics')
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [predictions, setPredictions] = useState(null)
  const [claims, setClaims] = useState([])
  const [fraudClaims, setFraudClaims] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Tab-specific states
  const [selectedFraud, setSelectedFraud] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [triggerForm, setTriggerForm] = useState({
    event_type: 'rain_15mm',
    trigger_value: 25,
    city: 'Mumbai',
    message: '',
    severity_override: 0.7,
    duration_days: 1
  })
  const [triggerResult, setTriggerResult] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [statsRes, analyticsRes, predictionsRes, claimsRes, fraudRes] = await Promise.all([
        getAdminStats(),
        getAdminAnalytics(),
        getAdminPredictions(),
        getAllClaims(),
        getFraudClaims()
      ])
      setStats(statsRes.data)
      setAnalytics(analyticsRes.data)
      setPredictions(predictionsRes.data)
      setClaims(claimsRes.data || [])
      setFraudClaims(fraudRes.data || [])
      
      // If we had a selected fraud claim, try to keep it selected if still present
      if (selectedFraud) {
        const stillPresent = fraudRes.data?.find(c => c.claim_id === selectedFraud.claim_id)
        if (!stillPresent) setSelectedFraud(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const runTrigger = async () => {
    const res = await triggerEvent({
      ...triggerForm,
      trigger_value: Number(triggerForm.trigger_value),
      severity_override: Number(triggerForm.severity_override),
      duration_days: Number(triggerForm.duration_days)
    })
    setTriggerResult(res.data)
    load()
  }

  const submitReview = async (action) => {
    if (!selectedFraud) return
    await reviewClaim({
      claim_id: selectedFraud.claim_id,
      action,
      review_note: reviewNote,
      reviewed_by: user.user_id
    })
    setSelectedFraud(null)
    setReviewNote('')
    load()
  }

  if (loading && !stats) {
    return <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading insurer control panel...</div>
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Insurer control panel</p>
            <h1 className="mt-1 text-3xl font-black text-slate-900">ZENVY Stage 3 Analytics</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Sync Data</button>
          </div>
        </div>
        
        <nav className="mt-8 flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'fraud' && fraudClaims.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                  {fraudClaims.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'analytics' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <MetricCard label="Loss Ratio" value={`${Math.round((analytics?.kpis?.loss_ratio || 0) * 100)}%`} color="text-rose-600" />
              <MetricCard label="Fraud Rate" value={`${Math.round((analytics?.kpis?.fraud_rate || 0) * 100)}%`} color="text-amber-600" />
              <MetricCard label="Claim Volume" value={`${analytics?.kpis?.claim_volume_daily || 0}`} sub="Last 24h" />
              <MetricCard label="Active Policies" value={`${analytics?.kpis?.active_policies || 0}`} />
              <MetricCard label="Avg Payout Time" value={`${analytics?.kpis?.average_payout_time_hours || 0}h`} color="text-emerald-600" />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard title="Claims over time (Weekly trend)">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics?.claims_over_time || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="claims" stroke="#0ea5e9" strokeWidth={4} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="City-wise risk distribution">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics?.city_risk_distribution || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="average_risk_score" fill="#0f766e" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <ChartCard title="Fraud vs Clean distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={analytics?.fraud_breakdown || []} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={5} label>
                      {(analytics?.fraud_breakdown || []).map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-slate-900">Recent claim activity</h2>
                <div className="mt-6 space-y-4">
                  {claims.slice(0, 5).map(claim => (
                    <div key={claim.id} className="flex items-center justify-between rounded-2xl border border-slate-50 bg-slate-50/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white font-bold shadow-sm ${claim.fraud_flagged ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {claim.fraud_flagged ? '⚠️' : '✅'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{claim.user_name}</p>
                          <p className="text-xs text-slate-500">{claim.trigger_event} • {claim.user_city}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900">Rs {Math.round(claim.payout_amount)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{new Date(claim.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-black text-slate-900">Next-week claim forecast</h2>
                <p className="mt-2 text-slate-500">AI-driven projection based on historical claim volume and city-wise risk trends.</p>
                
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  <div className="rounded-3xl bg-sky-50 p-6 ring-1 ring-sky-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Predicted claims</p>
                    <h3 className="mt-2 text-5xl font-black text-sky-900">{predictions?.next_week_predicted_claims || 0}</h3>
                    <p className="mt-3 text-sm text-sky-700 font-medium">↑ 15% increase expected</p>
                  </div>
                  <div className="rounded-3xl bg-emerald-50 p-6 ring-1 ring-emerald-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Estimated exposure</p>
                    <h3 className="mt-2 text-5xl font-black text-emerald-900">Rs {Math.round(predictions?.expected_payout_amount || 0).toLocaleString()}</h3>
                    <p className="mt-3 text-sm text-emerald-700 font-medium">Weekly payout budget</p>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-bold text-slate-800">Claims by disruption type</h3>
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {(predictions?.by_event_type || []).map(event => (
                      <div key={event.event_type} className="rounded-2xl border border-slate-100 p-4">
                        <p className="text-xs font-bold text-slate-400">{event.event_type.replace('_', ' ').toUpperCase()}</p>
                        <p className="mt-1 text-xl font-black text-slate-800">{event.claims}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-black text-slate-900">Risk hotspots</h2>
                <p className="mt-2 text-sm text-slate-500">Cities requiring immediate policy adjustments or higher reserves.</p>
                <div className="mt-8 space-y-4">
                  {(predictions?.high_risk_cities || []).map(city => (
                    <div key={city.city} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-slate-800">{city.city}</p>
                          <p className="text-sm text-slate-500">{city.active_policies} active policies</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-slate-900">{Math.round(city.avg_risk_score * 100)}%</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Risk level</p>
                        </div>
                      </div>
                      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div 
                          className={`h-full transition-all duration-1000 ${city.avg_risk_score >= 0.6 ? 'bg-rose-500' : 'bg-amber-500'}`} 
                          style={{ width: `${city.avg_risk_score * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fraud' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-black text-slate-900">Fraud review queue</h2>
                <p className="mt-2 text-sm text-slate-500">Claims flagged by the AI engine for manual inspection and audit trail.</p>
                <div className="mt-6 flex flex-col gap-3">
                  {fraudClaims.length === 0 ? (
                    <div className="rounded-3xl bg-slate-50 p-12 text-center text-slate-400">Queue is empty. No flagged claims.</div>
                  ) : (
                    fraudClaims.map((claim) => (
                      <button
                        key={claim.claim_id}
                        onClick={() => setSelectedFraud(claim)}
                        className={`w-full rounded-2xl border p-5 text-left transition-all ${
                          selectedFraud?.claim_id === claim.claim_id 
                            ? 'border-rose-400 bg-rose-50 shadow-md ring-1 ring-rose-200' 
                            : 'border-slate-100 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-slate-800">{claim.user_name}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{claim.city} • {claim.trigger_event}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-rose-600">{Math.round(claim.fraud_score * 100)}%</span>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">FRAUD SCORE</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                {!selectedFraud ? (
                  <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-3xl">🛡️</div>
                    <h3 className="mt-4 text-xl font-bold text-slate-800">Select a claim to review</h3>
                    <p className="mt-2 max-w-xs text-sm text-slate-500">Inspect evidence, check audit history, and approve or reject the claim payout.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-slate-900">Claim Details #{selectedFraud.claim_id}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${selectedFraud.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                          {selectedFraud.status}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-500 font-medium">{selectedFraud.user_name} ({selectedFraud.user_role})</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Risk Severity</p>
                        <p className="text-xl font-black text-slate-800">Critical Risk</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Payout Exposure</p>
                        <p className="text-xl font-black text-slate-900">Rs {Math.round(selectedFraud.payout_amount)}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-rose-100 bg-rose-50/30 p-6 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-rose-600 flex items-center gap-2">
                        <span>🔍</span> AI Detection Evidence
                      </h3>
                      <ul className="mt-4 space-y-3">
                        {(selectedFraud.fraud_reasons || []).map((reason, idx) => (
                          <li key={idx} className="flex gap-3 text-sm text-slate-700">
                            <span className="text-rose-400">•</span>
                            <span className="leading-relaxed">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Review investigation notes</label>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={4}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-50"
                        placeholder="Detail rationale for approval or rejection... (Required for audit trail)"
                      />
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => submitReview('approved')}
                        className="flex-1 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700"
                      >
                        Approve Payout
                      </button>
                      <button 
                        onClick={() => submitReview('rejected')}
                        className="flex-1 rounded-2xl bg-rose-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-rose-100 hover:bg-rose-700"
                      >
                        Reject Claim
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'triggers' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-black text-slate-900">Simulation center</h2>
                <p className="mt-2 text-slate-500">Manually trigger disruption events across cities to test auto-claim logic and payout speeds.</p>
                
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Event Type</label>
                    <select 
                      value={triggerForm.event_type} 
                      onChange={(e) => setTriggerForm((f) => ({ ...f, event_type: e.target.value }))} 
                      className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium outline-none"
                    >
                      {EVENT_OPTIONS.map((event) => <option key={event} value={event}>{event.replace('_', ' ').toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Target City</label>
                    <input 
                      value={triggerForm.city} 
                      onChange={(e) => setTriggerForm((f) => ({ ...f, city: e.target.value }))} 
                      className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium outline-none"
                      placeholder="e.g. Mumbai or 'all'" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Trigger Value</label>
                    <input 
                      type="number" 
                      value={triggerForm.trigger_value} 
                      onChange={(e) => setTriggerForm((f) => ({ ...f, trigger_value: e.target.value }))} 
                      className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Severity Override</label>
                    <input 
                      type="number" 
                      value={triggerForm.severity_override} 
                      step="0.1" 
                      max="1.0"
                      onChange={(e) => setTriggerForm((f) => ({ ...f, severity_override: e.target.value }))} 
                      className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium outline-none" 
                    />
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Internal Note/Message</label>
                  <input 
                    value={triggerForm.message} 
                    onChange={(e) => setTriggerForm((f) => ({ ...f, message: e.target.value }))} 
                    className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium outline-none"
                    placeholder="Brief description for workers..." 
                  />
                </div>

                <button 
                  onClick={runTrigger} 
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-rose-100 hover:bg-rose-700"
                >
                  ⚡ Trigger Global Disruption
                </button>

                {triggerResult && (
                  <div className="mt-6 animate-pulse rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-start gap-4">
                      <span className="text-2xl">🚨</span>
                      <div>
                        <p className="font-bold text-emerald-900 uppercase text-xs tracking-widest">Simulation Success</p>
                        <p className="mt-1 text-emerald-700 text-sm leading-relaxed">
                          Disruption deployed in {triggerResult.city || 'Mumbai'}. 
                          <span className="font-black"> {triggerResult.workers_affected} workers </span> affected. 
                          <span className="font-black"> {triggerResult.payouts_created} payouts</span> auto-processed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900">Automation Scheduler</h3>
                  <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 animate-pulse rounded-full bg-emerald-500"></div>
                      <p className="text-sm font-bold text-slate-700">Real-time weather polling</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 animate-pulse rounded-full bg-emerald-500"></div>
                      <p className="text-sm font-bold text-slate-700">Platform drop detection</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 animate-pulse rounded-full bg-amber-500"></div>
                      <p className="text-sm font-bold text-slate-700">AQI pollution monitor</p>
                    </div>
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Pending Sync</span>
                  </div>
                </div>
                
                <div className="rounded-[32px] border border-slate-900 bg-slate-900 p-8 text-white shadow-xl">
                  <h3 className="text-xl font-bold">Stage 3 Demo Tip</h3>
                  <p className="mt-4 text-sm text-slate-400 leading-relaxed">
                    Trigger a <span className="text-rose-400 font-bold">'PLATFORM DROP'</span> event with 70% value in Mumbai to verify that the auto-claim logic correctly bypasses weather sensors and pays out based on gig platform data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color = "text-slate-900" }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p> : null}
    </div>
  )
}

    </div>
  )
}
