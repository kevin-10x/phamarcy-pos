import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  Clock,
  BarChart3,
  Receipt,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { get } from '../utils/api'
import type { Medicine, Sale } from '../types'

interface DashboardData {
  today_sales_count: number
  today_revenue: number
  today_profit: number
  monthly_revenue: number
  total_medicines_in_stock: number
  low_stock_medicines: Medicine[]
  expiring_soon_medicines: (Medicine & { nearest_expiry: string })[]
  top_selling_medicines: { name: string; quantity: number; revenue: number }[]
  recent_sales: Sale[]
}

const statCards = [
  {
    key: 'todaySales' as const,
    label: "Today's Sales",
    icon: ShoppingCart,
    gradient: 'from-emerald-500 to-emerald-600',
    bgLight: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    key: 'todayProfit' as const,
    label: "Today's Profit",
    icon: TrendingUp,
    gradient: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    key: 'monthlyRevenue' as const,
    label: 'Monthly Revenue',
    icon: DollarSign,
    gradient: 'from-purple-500 to-purple-600',
    bgLight: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    key: 'totalStock' as const,
    label: 'Total Medicines',
    icon: Package,
    gradient: 'from-orange-500 to-orange-600',
    bgLight: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
]

function formatKSh(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' },
  }),
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await get<DashboardData>('/api/reports/dashboard')
        setData(res)
      } catch {
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        No data available
      </div>
    )
  }

  const statValues = {
    todaySales: `${data.today_sales_count} sales · ${formatKSh(data.today_revenue)}`,
    todayProfit: formatKSh(data.today_profit),
    monthlyRevenue: formatKSh(data.monthly_revenue),
    totalStock: data.total_medicines_in_stock.toLocaleString(),
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back! Here's your pharmacy overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.key}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <div className={`rounded-xl bg-gradient-to-r ${card.gradient} p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">{card.label}</p>
                  <p className="text-xl font-bold mt-1">{statValues[card.key]}</p>
                </div>
                <div className="bg-white/20 rounded-lg p-2.5">
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial="hidden" animate="visible" variants={sectionVariants}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-900">Low Stock Alerts</h2>
            </div>
            <div className="overflow-x-auto">
              {data.low_stock_medicines.length === 0 ? (
                <p className="p-5 text-sm text-gray-500">No low stock items.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-5 py-2.5 font-medium">Medicine</th>
                      <th className="px-5 py-2.5 font-medium">Category</th>
                      <th className="px-5 py-2.5 font-medium text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.low_stock_medicines.map((med) => (
                      <tr key={med.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5">
                          <div className="font-medium text-gray-900">{med.brand_name}</div>
                          <div className="text-xs text-gray-500">{med.generic_name}</div>
                        </td>
                        <td className="px-5 py-2.5 text-gray-600">{med.category_name}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${med.current_stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {med.current_stock} {med.unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={sectionVariants}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Clock className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-gray-900">Expiring Soon</h2>
            </div>
            <div className="overflow-x-auto">
              {data.expiring_soon_medicines.length === 0 ? (
                <p className="p-5 text-sm text-gray-500">No medicines expiring soon.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-5 py-2.5 font-medium">Medicine</th>
                      <th className="px-5 py-2.5 font-medium">Expiry Date</th>
                      <th className="px-5 py-2.5 font-medium text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.expiring_soon_medicines.map((med) => (
                      <tr key={med.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5">
                          <div className="font-medium text-gray-900">{med.brand_name}</div>
                          <div className="text-xs text-gray-500">{med.generic_name}</div>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-red-600 font-medium">
                            {new Date(med.nearest_expiry).toLocaleDateString('en-KE')}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{med.current_stock} {med.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial="hidden" animate="visible" variants={sectionVariants}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-900">Top Selling Medicines</h2>
            </div>
            <div className="p-5">
              {data.top_selling_medicines.length === 0 ? (
                <p className="text-sm text-gray-500">No sales data for this month.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.top_selling_medicines} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'quantity' ? value : formatKSh(value),
                        name === 'quantity' ? 'Quantity' : 'Revenue',
                      ]}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="quantity" fill="#6366f1" radius={[4, 4, 0, 0]} name="quantity" />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="revenue" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={sectionVariants}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Receipt className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold text-gray-900">Recent Sales</h2>
            </div>
            <div className="overflow-x-auto">
              {data.recent_sales.length === 0 ? (
                <p className="p-5 text-sm text-gray-500">No recent sales.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-5 py-2.5 font-medium">#</th>
                      <th className="px-5 py-2.5 font-medium">Customer</th>
                      <th className="px-5 py-2.5 font-medium">Cashier</th>
                      <th className="px-5 py-2.5 font-medium text-right">Total</th>
                      <th className="px-5 py-2.5 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recent_sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-medium text-gray-900">#{sale.id}</td>
                        <td className="px-5 py-2.5 text-gray-600">{sale.customer_name || 'Walk-in'}</td>
                        <td className="px-5 py-2.5 text-gray-600">{sale.cashier_name}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-gray-900">{formatKSh(sale.total_amount)}</td>
                        <td className="px-5 py-2.5 text-gray-500 text-xs">
                          {new Date(sale.created_at).toLocaleDateString('en-KE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
