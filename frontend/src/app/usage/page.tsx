'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'

interface UsageSummary {
  period: string
  total_tokens: number
  total_cost_usd: number
  openai_tokens: number
  openai_cost_usd: number
  anthropic_tokens: number
  anthropic_cost_usd: number
  total_calls: number
}

interface DailyUsage {
  date: string
  tokens: number
  cost_usd: number
  calls: number
}

interface OperationUsage {
  operation: string
  tokens: number
  cost_usd: number
  calls: number
}

export default function UsagePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [operationUsage, setOperationUsage] = useState<OperationUsage[]>([])
  const [days, setDays] = useState(30)

  const API_URL = 'http://localhost:8000/api/v1'

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      fetchUsageData()
    }
  }, [user, days])

  const fetchUsageData = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }

      // Fetch all data in parallel
      const [summaryRes, dailyRes, operationRes] = await Promise.all([
        fetch(`${API_URL}/usage/summary?days=${days}`, { headers }),
        fetch(`${API_URL}/usage/daily?days=${days}`, { headers }),
        fetch(`${API_URL}/usage/by-operation?days=${days}`, { headers })
      ])

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json()
        setSummary(summaryData)
      }

      if (dailyRes.ok) {
        const dailyData = await dailyRes.json()
        setDailyUsage(dailyData.daily_usage || [])
      }

      if (operationRes.ok) {
        const operationData = await operationRes.json()
        setOperationUsage(operationData.by_operation || [])
      }

    } catch (err) {
      setError('Error loading usage data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num)
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(num)
  }

  if (authLoading || (loading && !summary)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">API Usage</h1>
            <p className="text-gray-600 mt-1">Monitor your API consumption and costs</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Cost */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(summary.total_cost_usd)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Tokens */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Tokens</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(summary.total_tokens)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Calls */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">API Calls</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(summary.total_calls)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Avg Cost per Call */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Cost/Call</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {summary.total_calls > 0
                      ? formatCurrency(summary.total_cost_usd / summary.total_calls)
                      : '$0.00'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Provider Breakdown */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* OpenAI */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">OpenAI</h3>
                  <p className="text-sm text-gray-500">Embeddings</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tokens</p>
                  <p className="text-lg font-semibold text-gray-900">{formatNumber(summary.openai_tokens)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cost</p>
                  <p className="text-lg font-semibold text-emerald-600">{formatCurrency(summary.openai_cost_usd)}</p>
                </div>
              </div>
            </div>

            {/* Anthropic */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Anthropic</h3>
                  <p className="text-sm text-gray-500">Claude (Classification, Summarization, Chat)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tokens</p>
                  <p className="text-lg font-semibold text-gray-900">{formatNumber(summary.anthropic_tokens)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cost</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(summary.anthropic_cost_usd)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage by Operation */}
        {operationUsage.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Usage by Operation</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Operation</th>
                    <th className="pb-3 font-medium text-right">Calls</th>
                    <th className="pb-3 font-medium text-right">Tokens</th>
                    <th className="pb-3 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {operationUsage.map((op) => (
                    <tr key={op.operation} className="border-b last:border-0">
                      <td className="py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {op.operation.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-900">{formatNumber(op.calls)}</td>
                      <td className="py-3 text-right text-gray-900">{formatNumber(op.tokens)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(op.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Usage */}
        {dailyUsage.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Daily Usage</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Calls</th>
                    <th className="pb-3 font-medium text-right">Tokens</th>
                    <th className="pb-3 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyUsage.slice().reverse().map((day) => (
                    <tr key={day.date} className="border-b last:border-0">
                      <td className="py-3 text-gray-900">{day.date}</td>
                      <td className="py-3 text-right text-gray-900">{formatNumber(day.calls)}</td>
                      <td className="py-3 text-right text-gray-900">{formatNumber(day.tokens)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(day.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!summary && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No usage data yet</h3>
            <p className="text-gray-500">Start using the app to see your API consumption metrics here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
