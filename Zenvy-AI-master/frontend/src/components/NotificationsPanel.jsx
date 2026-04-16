// ============================================================
// NotificationsPanel.jsx — User Notifications Panel
// ============================================================

import React, { useState, useEffect } from 'react'
import { useAuth } from '../App.jsx'
import { useI18n } from '../i18n.jsx'
import { getNotifications, markAllNotificationsRead } from '../api.js'

export default function NotificationsPanel() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (user?.user_id) {
      loadNotifications()
    }
  }, [user?.user_id])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await getNotifications(user.user_id)
      setNotifications(res.data || [])
    } catch (e) {
      console.error('Failed to load notifications:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(user.user_id)
    setNotifications(notifications.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const getNotificationIcon = (type) => {
    const icons = {
      'trigger_detected': '🌧️',
      'claim_created': '📝',
      'claim_approved': '✅',
      'payout_sent': '💸',
      'policy_expiring': '⏰',
      'policy_purchased': '🛡️',
      'fraud_flagged': '⚠️',
      'risk_alert': '🔔'
    }
    return icons[type] || '📌'
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return t('justNow')
    if (diffMins < 60) return `${diffMins} ${t('hoursAgo')}`
    if (diffHours < 24) return `${diffHours} ${t('hoursAgo')}`
    return `${diffDays} ${t('daysAgo')}`
  }

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-all"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">{t('yourAlerts')}</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {t('markAllRead')}
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-400">
                  ⏳ Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-gray-500 text-sm">{t('noAlertsDesc')}</p>
                </div>
              ) : (
                notifications.map((notif, idx) => (
                  <div 
                    key={notif.id || idx}
                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-all ${
                      !notif.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <span className="text-2xl">{getNotificationIcon(notif.type)}</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm">{notif.title}</p>
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{notif.message}</p>
                        <p className="text-gray-400 text-xs mt-1">{formatTime(notif.created_at)}</p>
                      </div>
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-100 text-center">
                <button className="text-sm text-blue-600 hover:underline">
                  {t('viewAll')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}