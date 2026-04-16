import axios from 'axios'

const API_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_API_URL || 'https://zenvy-backend-sxkp.onrender.com')

const API = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('zenvy_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const signup = (data) => API.post('/auth/signup', data)
export const login = (data) => API.post('/auth/login', data)
export const getMe = (userId) => API.get(`/auth/me?user_id=${userId}`)

export const assessRisk = (features, role) => API.post(`/risk/assess?role=${role}`, features)
export const getWeatherRisk = (city, role) => API.get(`/risk/weather/${city}?role=${role}`)
export const getRiskSnapshots = (city = 'Mumbai') => API.get(`/risk/snapshots?city=${city}`)

export const buyPolicy = (userId, data) => API.post(`/policy/buy?user_id=${userId}`, data)
export const getActivePolicy = (userId) => API.get(`/policy/active/${userId}`)
export const getPolicyHistory = (userId) => API.get(`/policy/history/${userId}`)

export const fileClaim = (userId, data) => API.post(`/claims/file?user_id=${userId}`, data)
export const getClaimsHistory = (userId) => API.get(`/claims/history/${userId}`)
export const getAlerts = (userId) => API.get(`/claims/alerts/${userId}`)
export const markAlertRead = (alertId) => API.post(`/claims/alerts/${alertId}/read`)
export const triggerEvent = (data) => API.post('/claims/trigger', data)

export const getAdminStats = () => API.get('/admin/stats')
export const getAdminAnalytics = () => API.get('/admin/analytics')
export const getAdminPredictions = () => API.get('/admin/predictions')
export const getAllUsers = () => API.get('/admin/users')
export const getAllClaims = () => API.get('/admin/claims')
export const getMapData = () => API.get('/admin/map-data')
export const getFraudAlerts = () => API.get('/admin/fraud-alerts')
export const getFraudClaims = () => API.get('/admin/fraud-claims')
export const getAdminRiskTrend = () => API.get('/admin/risk-trend')
export const updateClaimStatus = (claimId, status) => API.post(`/admin/claim/${claimId}/status?status=${status}`)
export const reviewClaim = (data) => API.post('/admin/review-claim', data)

export const getNotifications = (userId) => API.get(`/notifications/${userId}`)
export const markAllNotificationsRead = (userId) => API.post(`/notifications/${userId}/read-all`)
export const createNotification = (data) => API.post('/notifications/create', data)

export const getDashboardInsights = (userId) => API.get(`/dashboard/insights?user_id=${userId}`)
export const initiatePayment = (data) => API.post('/payments/initiate', data)

export default API
