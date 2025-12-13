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

  // Hardcoded API URL - always use HTTPS
  const API_URL = 'https://knowledge-base-ai-production.up.railway.app/api/v1'

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
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }

      // Fetch all data in a single optimized request
      const response = await fetch(`${API_URL}/usage/all?days=${days}`, { headers })

      if (response.ok) {
        const data = await response.json()
        setSummary(data.summary)
        setDailyUsage(data.daily_usage || [])
        setOperationUsage(data.by_operation || [])
      } else {
        // Set empty summary so page renders
        setSummary({
          period: `last_${days}_days`,
          total_tokens: 0,
          total_cost_usd: 0,
          openai_tokens: 0,
          openai_cost_usd: 0,
          anthropic_tokens: 0,
          anthropic_cost_usd: 0,
          total_calls: 0
        })
      }

    } catch (err) {
      setError('Error loading usage data')
      console.error(err)
      // Set empty summary so page doesn't hang
      setSummary({
        period: `last_${days}_days`,
        total_tokens: 0,
        total_cost_usd: 0,
        openai_tokens: 0,
        openai_cost_usd: 0,
        anthropic_tokens: 0,
        anthropic_cost_usd: 0,
        total_calls: 0
      })
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Usage</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor your API consumption and costs</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Data completeness warning */}
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">Datos incompletos</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">Los datos de consumo pueden estar incompletos para contenidos procesados antes del 2 de diciembre de 2025.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Cost */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatCurrency(summary.total_cost_usd)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Tokens */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatNumber(summary.total_tokens)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Calls */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">API Calls</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatNumber(summary.total_calls)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Avg Cost per Call */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg Cost/Call</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {summary.total_calls > 0
                      ? formatCurrency(summary.total_cost_usd / summary.total_calls)
                      : '$0.00'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500 dark:bg-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">OpenAI</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Embeddings</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tokens</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(summary.openai_tokens)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Cost</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.openai_cost_usd)}</p>
                </div>
              </div>
            </div>

            {/* Anthropic */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-500 dark:bg-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Anthropic</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Claude (Classification, Summarization, Chat)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tokens</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatNumber(summary.anthropic_tokens)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Cost</p>
                  <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(summary.anthropic_cost_usd)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage by Operation */}
        {operationUsage.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Usage by Operation</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b dark:border-gray-600">
                    <th className="pb-3 font-medium">Operation</th>
                    <th className="pb-3 font-medium text-right">Calls</th>
                    <th className="pb-3 font-medium text-right">Tokens</th>
                    <th className="pb-3 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {operationUsage.map((op) => (
                    <tr key={op.operation} className="border-b dark:border-gray-700 last:border-0">
                      <td className="py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 capitalize">
                          {op.operation.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-900 dark:text-gray-300">{formatNumber(op.calls)}</td>
                      <td className="py-3 text-right text-gray-900 dark:text-gray-300">{formatNumber(op.tokens)}</td>
                      <td className="py-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(op.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Usage */}
        {dailyUsage.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Daily Usage</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-white dark:bg-gray-800">
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b dark:border-gray-600">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Calls</th>
                    <th className="pb-3 font-medium text-right">Tokens</th>
                    <th className="pb-3 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyUsage.slice().reverse().map((day) => (
                    <tr key={day.date} className="border-b dark:border-gray-700 last:border-0">
                      <td className="py-3 text-gray-900 dark:text-gray-300">{day.date}</td>
                      <td className="py-3 text-right text-gray-900 dark:text-gray-300">{formatNumber(day.calls)}</td>
                      <td className="py-3 text-right text-gray-900 dark:text-gray-300">{formatNumber(day.tokens)}</td>
                      <td className="py-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(day.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!summary && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No usage data yet</h3>
            <p className="text-gray-500 dark:text-gray-400">Start using the app to see your API consumption metrics here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
