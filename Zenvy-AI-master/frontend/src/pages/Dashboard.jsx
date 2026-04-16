import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useAuth } from '../App.jsx'
import { getDashboardInsights, getWeatherRisk } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'
import StatCard from '../components/StatCard.jsx'
import { useI18n } from '../i18n.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [insights, setInsights] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [insightsRes, weatherRes] = await Promise.all([
          getDashboardInsights(user.user_id),
          getWeatherRisk(user.city, user.role)
        ])
        setInsights(insightsRes.data)
        setWeather(weatherRes.data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) {
    return <div className="rounded-[32px] bg-white p-20 text-center text-slate-400 shadow-sm ring-1 ring-slate-100">Loading your AI command center...</div>
  }

  const policy = insights?.active_policy
  const forecast = insights?.risk_forecast || []
  const riskTrend = insights?.risk_trend || []
  const premiumVsPayout = insights?.premium_vs_payout || []
  const alerts = insights?.recent_notifications || []
  const risk = weather?.risk

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[36px] bg-slate-950 p-8 text-white shadow-2xl lg:p-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-[100px]" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-teal-500/10 blur-[100px]" />
        
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">{t('dashboard').toUpperCase()}</p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              {t('welcomeBack')}, {user.name.split(' ')[0]}
            </h1>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed font-medium">
              Your gig earnings in <span className="text-white">{user.city}</span> are protected by ZENVY's multi-signal disruption engine.
            </p>
            
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('active')}</p>
                <p className="mt-1 font-bold text-emerald-400">{policy ? 'Secured Coverage' : 'No Active Policy'}</p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('city')}</p>
                <p className="mt-1 font-bold text-white">{user.city}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-white/5 border border-white/10 p-6 backdrop-blur-xl lg:min-w-[300px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">{t('riskLevel')}</p>
                <h3 className="mt-1 text-4xl font-black text-white">{Math.round((risk?.risk_score || 0) * 100)}%</h3>
              </div>
              {risk && <RiskBadge level={risk.risk_level} score={risk.risk_score} />}
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all duration-1000" 
                  style={{ width: `${(risk?.risk_score || 0) * 100}%` }}
                />
              </div>
              <p className="text-sm font-medium text-slate-400 italic">" {insights?.ai_recommendation} "</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard 
          icon="Shield" 
          label={t('activePolicies')} 
          value={policy ? `Rs${policy.weekly_premium}` : '--'} 
          sub={policy ? t('active') : t('buyPolicy')} 
          color={policy ? 'green' : 'gray'} 
        />
        <StatCard 
          icon="Earnings" 
          label={t('weeklyEarnings')} 
          value={`Rs${(insights?.protected_earnings_weekly || 0).toLocaleString()}`} 
          sub="Income floor base" 
          color="blue" 
        />
        {policy && (
        <StatCard 
          icon="Shield" 
          label="Protected Earnings" 
          value={`Rs${(insights?.total_payouts_collected || 0).toLocaleString()}`} 
          sub="Total received" 
          color="green" 
        />
        )}
        <StatCard 
          icon="Forecast" 
          label={t('riskAssessment')} 
          value={forecast[0] ? `${Math.round(forecast[0].risk_score * 100)}%` : '--'} 
          sub="3-day projection" 
          color="orange" 
        />
        <StatCard 
          icon="Weather" 
          label={t('currentWeather')} 
          value={`${weather?.weather?.temperature?.toFixed(0) || '--'}°C`} 
          sub={`${weather?.weather?.aqi?.toFixed(0) || '--'} AQI`} 
          color="purple" 
        />
      </section>

      {/* Main Charts Area */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">{t('yourRiskOverview')}</h2>
              <p className="text-sm font-medium text-slate-500">Real-time volatility and disruption signals</p>
            </div>
            <div className="flex gap-2">
               <span className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-[10px] font-bold text-sky-600 uppercase">Live Feed</span>
            </div>
          </header>
          
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={riskTrend}>
              <defs>
                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 1]} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`${Math.round(value * 100)}%`, 'Disruption Score']}
              />
              <Area type="monotone" dataKey="risk_score" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorRisk)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">3-Day Forecast</h2>
          <div className="mt-8 space-y-4">
            {forecast.map((item) => (
              <div key={item.day} className="group flex items-center justify-between rounded-2xl border border-slate-50 bg-slate-50/50 p-5 transition-all hover:bg-white hover:shadow-lg hover:ring-1 hover:ring-slate-100">
                <div className="flex items-center gap-4">
                   <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm`}>
                      {item.risk_score > 0.6 ? '⛈️' : item.risk_score > 0.3 ? '☁️' : '☀️'}
                   </div>
                   <div>
                    <p className="font-bold text-slate-800">{item.day}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.risk_level}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900">{Math.round(item.risk_score * 100)}%</p>
                </div>
              </div>
            ))}
          </div>
          {!policy && (
            <Link to="/policy" className="mt-8 block w-full rounded-2xl bg-slate-900 py-4 text-center text-sm font-bold text-white shadow-xl shadow-slate-200 transition-transform active:scale-[0.98]">
              {t('buyPolicy')}
            </Link>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">{t('payouts')} Analysis</h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">Comparison of your total premiums vs collected payouts</p>
          <div className="mt-8">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={premiumVsPayout}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="amount" fill="#0f766e" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">{t('recentAlerts')}</h2>
            <Link to="/alerts" className="text-xs font-bold text-sky-600 uppercase tracking-widest hover:underline">{t('viewAll')}</Link>
          </div>
          <div className="mt-8 space-y-4">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <div className="text-4xl">🔔</div>
                <p className="mt-4 text-sm font-medium text-slate-400">{t('noAlerts')}</p>
              </div>
            ) : (
              alerts.slice(0, 3).map((item) => (
                <div key={item.id} className="flex gap-4 rounded-[24px] border border-slate-50 bg-slate-50/50 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                    {item.title.toLowerCase().includes('payout') ? '💰' : '🔔'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                       <p className="font-bold text-slate-800">{item.title}</p>
                       {!item.is_read && <span className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_10px_rgb(14_165_233)]" />}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 font-medium leading-relaxed">{item.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
