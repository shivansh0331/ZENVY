import React, { useState } from 'react'
import { initiatePayment } from '../api.js'
import { useAuth } from '../App.jsx'
import { useI18n } from '../i18n.jsx'

export default function PaymentModal({ isOpen, onClose, amount, onSuccess }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [method, setMethod] = useState('upi')
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [upiId, setUpiId] = useState(`${user.name.split(' ')[0].toLowerCase()}@okaxis`)

  if (!isOpen) return null

  const handlePay = async () => {
    setProcessing(true)
    try {
      // Small simulation delay
      await new Promise(r => setTimeout(r, 1500))
      
      const res = await initiatePayment({
        amount,
        purpose: 'policy_purchase',
        user_id: user.user_id,
        method
      })
      setReceipt(res.data)
      if (onSuccess) await onSuccess(res.data)
    } finally {
      setProcessing(false)
    }
  }

  const handleDownloadPDF = () => {
    if (!receipt) return
    const content = `
      ZENVY INSURANCE RECEIPT
      -----------------------
      Transaction ID: ${receipt.transaction_id}
      Date: ${new Date().toLocaleString()}
      User: ${user.name}
      City: ${user.city}
      Amount Paid: Rs ${receipt.amount}
      Coverage: Weekly Income Protection (7 Days)
      Status: ACTIVE
    `
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `zenvy_receipt_${receipt.transaction_id.slice(0, 8)}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleClose = () => {
    setReceipt(null)
    setMethod('upi')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight">ZENVY <span className="text-sky-400">Secure</span></h3>
              <p className="mt-1 text-xs font-medium text-slate-400 uppercase tracking-widest">Gateway v3.0</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              🔒
            </div>
          </div>
        </div>

        <div className="p-8">
          {receipt ? (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full bg-emerald-500 flex items-center justify-center text-3xl shadow-lg shadow-emerald-200 text-white animate-bounce">
                  ✓
                </div>
                <h2 className="mt-6 text-2xl font-black text-slate-900">{t('paymentSuccessful')}</h2>
                <p className="mt-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{t('policyActivated')}</p>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 space-y-4">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                   <span>Details</span>
                   <span>Receipt</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Transaction ID</span>
                    <span className="text-sm font-mono font-bold text-slate-800">{receipt.transaction_id.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Premium Paid</span>
                    <span className="text-sm font-bold text-slate-900">Rs {receipt.amount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Method</span>
                    <span className="text-xs font-bold bg-white px-2 py-1 rounded-lg border border-slate-100 uppercase">{receipt.method}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDownloadPDF}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-sky-50 py-4 text-sm font-bold text-sky-600 hover:bg-sky-100 transition-colors"
                >
                  📥 Download PDF Receipt
                </button>
                <button 
                  onClick={handleClose} 
                  className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white shadow-xl shadow-slate-200"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Payment Method Selector */}
              <div className="grid grid-cols-3 gap-3">
                {['upi', 'card', 'wallet'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setMethod(opt)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
                      method === opt 
                        ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500 shadow-sm' 
                        : 'border-slate-100 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl">{opt === 'upi' ? '⚡' : opt === 'card' ? '💳' : '👛'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t(opt)}</span>
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="space-y-4">
                {method === 'upi' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">{t('upiId')}</label>
                    <input
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-sky-500 focus:bg-white transition-all"
                      placeholder="username@okaxis"
                    />
                  </div>
                )}
                {method === 'card' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                     <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Card Number</label>
                        <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none" placeholder="xxxx xxxx xxxx xxxx" />
                     </div>
                     <div className="flex gap-3">
                        <div className="flex-1">
                           <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Expiry</label>
                           <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none" placeholder="MM/YY" />
                        </div>
                        <div className="flex-1">
                           <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">CVV</label>
                           <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none" placeholder="***" type="password" />
                        </div>
                     </div>
                  </div>
                )}
              </div>

              {/* Total Amount Card */}
              <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl shadow-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{t('totalAmount')}</p>
                  <p className="mt-1 text-2xl font-black italic">Rs {amount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-sky-400 tracking-widest">Premium</p>
                  <p className="text-xs text-white/60">7 Days Cover</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                  {t('close')}
                </button>
                <button
                  onClick={handlePay}
                  disabled={processing}
                  className="flex-[2] rounded-2xl bg-sky-600 py-4 text-sm font-bold text-white shadow-lg shadow-sky-100 disabled:opacity-50 hover:bg-sky-700 transition-all flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('processing')}
                    </>
                  ) : (
                    <>
                      {t('payNow')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex items-center justify-center gap-2">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PCI-DSS Compliant</span>
           <span className="h-1 w-1 rounded-full bg-slate-300" />
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SSL Encrypted</span>
        </div>
      </div>
    </div>
  )
}
