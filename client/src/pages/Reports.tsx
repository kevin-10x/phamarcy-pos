import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Receipt,
  Calendar,
  Download,
  Wallet,
  CreditCard,
  Smartphone,
  Shield,
  Clock,
  FileText,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import { get } from '../utils/api'

type Tab = 'sales' | 'inventory' | 'financial' | 'cash'

interface SalesReportData {
  summary: {
    total_revenue: number
    total_sales: number
    average_sale: number
    total_vat: number
  }
  chart_data: { period: string; revenue: number; sales: number }[]
  breakdown: { period: string; sales_count: number; revenue: number; vat: number; avg: number }[]
}

interface InventoryReportData {
  category_breakdown: { name: string; value: number; count: number }[]
  stock_list: {
    id: number
    brand_name: string
    generic_name: string
    category_name: string
    current_stock: number
    unit: string
    purchase_price: number
    selling_price: number
    total_value: number
  }[]
  summary: {
    total_medicines: number
    total_stock_value: number
    low_stock_count: number
    expiring_soon_count: number
  }
}

interface FinancialReportData {
  summary: {
    total_revenue: number
    total_cost: number
    total_expenses: number
    gross_profit: number
    net_profit: number
  }
  monthly_data: { month: string; revenue: number; cost: number; expenses: number }[]
  expenses_by_category: { category: string; amount: number }[]
}

interface CashSummaryData {
  today_breakdown: {
    cash: number
    mpesa: number
    card: number
    insurance: number
    credit: number
  }
  net_cash_position: number
  total_transactions: number
  chart_data: { method: string; amount: number; count: number }[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

function formatKSh(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'sales', label: 'Sales Report', icon: TrendingUp },
  { key: 'inventory', label: 'Inventory Report', icon: Package },
  { key: 'financial', label: 'Financial Report', icon: DollarSign },
  { key: 'cash', label: 'Cash Summary', icon: Wallet },
]

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('sales')
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">View detailed pharmacy reports and analytics.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && <SalesReport loading={loading} setLoading={setLoading} />}
      {activeTab === 'inventory' && <InventoryReport loading={loading} setLoading={setLoading} />}
      {activeTab === 'financial' && <FinancialReport loading={loading} setLoading={setLoading} />}
      {activeTab === 'cash' && <CashSummary loading={loading} setLoading={setLoading} />}
    </div>
  )
}

function SalesReport({ loading, setLoading }: { loading: boolean; setLoading: (v: boolean) => void }) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('monthly')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<SalesReportData | null>(null)

  const fetchSalesReport = async () => {
    setLoading(true)
    try {
      const params = `?period=${period}&start_date=${startDate}&end_date=${endDate}`
      const res = await get<SalesReportData>(`/reports/sales${params}`)
      setData(res)
    } catch {
      toast.error('Failed to load sales report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSalesReport()
  }, [period, startDate, endDate])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['daily', 'weekly', 'monthly', 'annual'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                period === p ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: formatKSh(data.summary.total_revenue), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Sales', value: data.summary.total_sales.toString(), icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Average Sale', value: formatKSh(data.summary.average_sale), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Total VAT', value: formatKSh(data.summary.total_vat), icon: Receipt, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                  </div>
                  <div className={`${card.bg} rounded-lg p-2.5`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data.chart_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [formatKSh(value), 'Revenue']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '12px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Revenue" />
                  <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} name="Sales Count" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Period Breakdown</h3>
                <button className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-5 py-2.5 font-medium">Period</th>
                      <th className="px-5 py-2.5 font-medium text-right">Sales</th>
                      <th className="px-5 py-2.5 font-medium text-right">Revenue</th>
                      <th className="px-5 py-2.5 font-medium text-right">VAT</th>
                      <th className="px-5 py-2.5 font-medium text-right">Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.breakdown.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-medium text-gray-900">{row.period}</td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{row.sales_count}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-gray-900">{formatKSh(row.revenue)}</td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{formatKSh(row.vat)}</td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{formatKSh(row.avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </div>
  )
}

function InventoryReport({ loading, setLoading }: { loading: boolean; setLoading: (v: boolean) => void }) {
  const [data, setData] = useState<InventoryReportData | null>(null)

  useEffect(() => {
    const fetchInventoryReport = async () => {
      setLoading(true)
      try {
        const res = await get<InventoryReportData>('/reports/inventory')
        setData(res)
      } catch {
        toast.error('Failed to load inventory report')
      } finally {
        setLoading(false)
      }
    }
    fetchInventoryReport()
  }, [])

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Medicines', value: data.summary.total_medicines.toString(), icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Stock Value', value: formatKSh(data.summary.total_stock_value), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Low Stock Items', value: data.summary.low_stock_count.toString(), icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Expiring Soon', value: data.summary.expiring_soon_count.toString(), icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                  </div>
                  <div className={`${card.bg} rounded-lg p-2.5`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Category Breakdown</h3>
                {data.category_breakdown.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No category data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.category_breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {data.category_breakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatKSh(value), 'Value']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Category Details</h3>
                <div className="space-y-3">
                  {data.category_breakdown.map((cat, i) => (
                    <div key={cat.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                          <p className="text-xs text-gray-500">{cat.count} items</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{formatKSh(cat.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Full Stock List</h3>
                <button className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-5 py-2.5 font-medium">Medicine</th>
                      <th className="px-5 py-2.5 font-medium">Category</th>
                      <th className="px-5 py-2.5 font-medium text-right">Stock</th>
                      <th className="px-5 py-2.5 font-medium text-right">Purchase</th>
                      <th className="px-5 py-2.5 font-medium text-right">Selling</th>
                      <th className="px-5 py-2.5 font-medium text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.stock_list.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5">
                          <div className="font-medium text-gray-900">{item.brand_name}</div>
                          <div className="text-xs text-gray-500">{item.generic_name}</div>
                        </td>
                        <td className="px-5 py-2.5 text-gray-600">{item.category_name}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.current_stock <= 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {item.current_stock} {item.unit}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{formatKSh(item.purchase_price)}</td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{formatKSh(item.selling_price)}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-gray-900">{formatKSh(item.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </div>
  )
}

function FinancialReport({ loading, setLoading }: { loading: boolean; setLoading: (v: boolean) => void }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<FinancialReportData | null>(null)

  useEffect(() => {
    const fetchFinancialReport = async () => {
      setLoading(true)
      try {
        const res = await get<FinancialReportData>(`/reports/financial?start_date=${startDate}&end_date=${endDate}`)
        setData(res)
      } catch {
        toast.error('Failed to load financial report')
      } finally {
        setLoading(false)
      }
    }
    fetchFinancialReport()
  }, [startDate, endDate])

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center justify-end">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Revenue', value: formatKSh(data.summary.total_revenue), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: DollarSign },
              { label: 'Total Cost', value: formatKSh(data.summary.total_cost), color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingDown },
              { label: 'Total Expenses', value: formatKSh(data.summary.total_expenses), color: 'text-orange-600', bg: 'bg-orange-50', icon: Receipt },
              { label: 'Gross Profit', value: formatKSh(data.summary.gross_profit), color: 'text-purple-600', bg: 'bg-purple-50', icon: TrendingUp },
              { label: 'Net Profit', value: formatKSh(data.summary.net_profit), color: data.summary.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data.summary.net_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50', icon: data.summary.net_profit >= 0 ? TrendingUp : TrendingDown },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{card.value}</p>
                  </div>
                  <div className={`${card.bg} rounded-lg p-2.5`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Revenue vs Cost vs Expenses</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.monthly_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatKSh(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Cost" />
                    <Bar dataKey="expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Expenses by Category</h3>
                {data.expenses_by_category.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No expenses recorded</p>
                ) : (
                  <div className="space-y-3">
                    {data.expenses_by_category.map((exp, i) => {
                      const maxAmount = Math.max(...data.expenses_by_category.map((e) => e.amount))
                      const pct = maxAmount > 0 ? (exp.amount / maxAmount) * 100 : 0
                      return (
                        <div key={exp.category}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{exp.category}</span>
                            <span className="text-sm font-semibold text-gray-900">{formatKSh(exp.amount)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function CashSummary({ loading, setLoading }: { loading: boolean; setLoading: (v: boolean) => void }) {
  const [data, setData] = useState<CashSummaryData | null>(null)

  useEffect(() => {
    const fetchCashSummary = async () => {
      setLoading(true)
      try {
        const res = await get<CashSummaryData>('/reports/cash-summary')
        setData(res)
      } catch {
        toast.error('Failed to load cash summary')
      } finally {
        setLoading(false)
      }
    }
    fetchCashSummary()
  }, [])

  const paymentMethods = [
    { key: 'cash', label: 'Cash', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'mpesa', label: 'M-Pesa', icon: Smartphone, color: 'text-green-600', bg: 'bg-green-50' },
    { key: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'insurance', label: 'Insurance', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'credit', label: 'Credit', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  ] as const

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : data ? (
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-lg p-3">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-emerald-100">Net Cash Position</p>
                  <p className="text-3xl font-bold">{formatKSh(data.net_cash_position)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-100">
                <FileText className="w-4 h-4" />
                <span>{data.total_transactions} transactions today</span>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {paymentMethods.map((method, i) => {
              const amount = data.today_breakdown[method.key as keyof typeof data.today_breakdown] || 0
              const chartEntry = data.chart_data.find((c) => c.method.toLowerCase() === method.key)
              return (
                <motion.div
                  key={method.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white rounded-xl border border-gray-200 p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{method.label}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{formatKSh(amount)}</p>
                      {chartEntry && (
                        <p className="text-xs text-gray-400 mt-0.5">{chartEntry.count} txns</p>
                      )}
                    </div>
                    <div className={`${method.bg} rounded-lg p-2.5`}>
                      <method.icon className={`w-5 h-5 ${method.color}`} />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Methods Breakdown</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.chart_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="method" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [name === 'amount' ? formatKSh(value) : value, name === 'amount' ? 'Amount' : 'Transactions']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '12px' }}
                  />
                  <Legend />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} name="Amount" />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </>
      ) : null}
    </div>
  )
}
