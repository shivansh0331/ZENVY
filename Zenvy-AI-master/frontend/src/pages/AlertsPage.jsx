import React, { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { useI18n } from '../i18n.jsx'
import { getAlerts, markAlertRead } from '../api.js'

const ALERT_ICONS = { rain: '🌧️', flood: '🌊', aqi: '😷', heat: '🌡️', admin: '🚨' }
const SEVERITY_COLORS = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  warning:  'bg-yellow-50 border-yellow-200 text-yellow-800'
}

export default function AlertsPage() {
  const { user }   = useAuth()
  const { t }     = useI18n()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAlerts(user.user_id)
      .then(r => setAlerts(r.data || []))
      .finally(() => setLoading(false))
  }, [])

  const handleRead = async (id) => {
    await markAlertRead(id)
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a))
  }

  if (loading) return <div className="text-center py-12 text-gray-400">⏳ Loading alerts...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🔔 {t('yourAlerts')}</h1>
        <span className="text-sm text-gray-500">{alerts.filter(a => !a.is_read).length} {t('unread')}</span>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500">{t('noAlertsDesc')}</p>
        </div>
      ) : (
        alerts.map(a => (
          <div key={a.id} className={`rounded-2xl border p-4 ${SEVERITY_COLORS[a.severity]} ${!a.is_read ? 'shadow-sm' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{ALERT_ICONS[a.alert_type] || '⚠️'}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{a.title}</p>
                    {!a.is_read && <span className="w-2 h-2 bg-red-500 rounded-full inline-block"></span>}
                  </div>
                  <p className="text-sm mt-1">{a.message}</p>
                  {a.trigger_value && (
                    <p className="text-xs mt-1 opacity-70">
                      Value: {a.trigger_value} (Threshold: {a.trigger_threshold})
                    </p>
                  )}
                  <p className="text-xs mt-1 opacity-60">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
              {!a.is_read && (
                <button onClick={() => handleRead(a.id)}
                  className="text-xs px-3 py-1 rounded-full bg-white/60 hover:bg-white border border-current transition-all">
                  {t('markAllRead')}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
