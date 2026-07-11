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
  Users,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { get } from '../utils/api'

interface DashboardData {
  today: { sales_count: number; revenue: number }
  all_time: { sales_count: number; revenue: number }
  customers: number
  medicines: number
  low_stock_count: number
  expiring_soon_count: number
  recent_sales: any[]
  top_medicines: { brand_name: string; total_sold: number; revenue: number }[]
}

const statCards = [
  { key: 'todaySales' as const, label: "Today's Sales", icon: ShoppingCart, gradient: 'from-emerald-500 to-emerald-600' },
  { key: 'todayRevenue' as const, label: "Today's Revenue", icon: DollarSign, gradient: 'from-blue-500 to-blue-600' },
  { key: 'totalMedicines' as const, label: 'Total Medicines', icon: Package, gradient: 'from-purple-500 to-purple-600' },
  { key: 'customers' as const, label: 'Customers', icon: Users, gradient: 'from-orange-500 to-orange-600' },
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
        const res = await get<DashboardData>('/reports/dashboard')
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
    todaySales: `${data.today.sales_count} sales`,
    todayRevenue: formatKSh(data.today.revenue),
    totalMedicines: data.medicines.toLocaleString(),
    customers: data.customers.toLocaleString(),
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back! Here's your pharmacy overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.key} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial="hidden" animate="visible" variants={sectionVariants} className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-900">Quick Stats</h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">Low Stock Items</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{data.low_stock_count}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm text-amber-600 font-medium">Expiring Soon</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">{data.expiring_soon_count}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={sectionVariants}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold text-gray-900">All Time</h2>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-xs text-gray-500">Total Sales</p>
                <p className="text-lg font-bold text-gray-900">{data.all_time.sales_count}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Revenue</p>
                <p className="text-lg font-bold text-gray-900">{formatKSh(data.all_time.revenue)}</p>
              </div>
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
              {data.top_medicines.length === 0 ? (
                <p className="text-sm text-gray-500">No sales data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.top_medicines} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="brand_name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [name === 'total_sold' ? value : formatKSh(value), name === 'total_sold' ? 'Quantity' : 'Revenue']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    />
                    <Bar dataKey="total_sold" fill="#6366f1" radius={[4, 4, 0, 0]} name="total_sold" />
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
                    {data.recent_sales.map((sale: any) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-medium text-gray-900">#{sale.id}</td>
                        <td className="px-5 py-2.5 text-gray-600">{sale.customer_name || 'Walk-in'}</td>
                        <td className="px-5 py-2.5 text-gray-600">{sale.user_name || 'N/A'}</td>
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
