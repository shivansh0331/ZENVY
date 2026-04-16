import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../App.jsx'
import { useI18n } from '../i18n.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import NotificationsPanel from './NotificationsPanel.jsx'

const ROLE_CONFIG = {
  food_delivery: { label: 'Food Delivery', emoji: 'FD', color: 'text-orange-600' },
  grocery_delivery: { label: 'Grocery Delivery', emoji: 'GR', color: 'text-green-600' },
  ecommerce_delivery: { label: 'E-commerce', emoji: 'EC', color: 'text-indigo-600' },
  admin: { label: 'Admin', emoji: 'AD', color: 'text-slate-600' }
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const roleConf = ROLE_CONFIG[user?.role] || ROLE_CONFIG.food_delivery
  const navItems = user?.role === 'admin'
    ? [
        { path: '/admin', icon: 'Analytics', label: t('adminDashboard') },
        { path: '/admin/fraud-review', icon: 'Review', label: 'Fraud Review' },
        { path: '/map', icon: 'Map', label: t('riskMap') }
      ]
    : [
        { path: '/dashboard', icon: 'Home', label: t('dashboard') },
        { path: '/policy', icon: 'Policy', label: t('myPolicy') },
        { path: '/claims', icon: 'Claim', label: t('fileClaim') },
        { path: '/alerts', icon: 'Alerts', label: t('alerts') },
        { path: '/payouts', icon: 'Payouts', label: t('payouts') },
        { path: '/map', icon: 'Map', label: t('riskMap') }
      ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
      isActive ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:translate-x-0 lg:shadow-none`}
      >
        <div className="border-b border-slate-100 p-6">
          <h1 className="text-2xl font-black tracking-tight text-sky-700">ZENVY</h1>
          <p className="mt-1 text-xs text-slate-500">{t('incomeInsuranceApp')}</p>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <LanguageSelector />
        </div>

        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-sky-700">
              {roleConf.emoji}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className={`text-xs font-medium ${roleConf.color}`}>{roleConf.label}</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={navLinkClass} onClick={() => setSidebarOpen(false)}>
              <span className="min-w-10 text-xs font-bold uppercase tracking-wide text-current/80">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50"
          >
            <span className="min-w-10 text-xs font-bold uppercase tracking-wide">Exit</span>
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-between border-b border-slate-200 bg-white px-6 py-3 lg:flex">
          <button
            onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            {user?.city || 'India'}
          </button>
          <NotificationsPanel />
        </header>

        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-xl p-2 hover:bg-slate-100">
            <div className="mb-1 h-0.5 w-5 bg-slate-700"></div>
            <div className="mb-1 h-0.5 w-5 bg-slate-700"></div>
            <div className="h-0.5 w-5 bg-slate-700"></div>
          </button>
          <h1 className="text-lg font-black text-sky-700">ZENVY</h1>
          <NotificationsPanel />
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
