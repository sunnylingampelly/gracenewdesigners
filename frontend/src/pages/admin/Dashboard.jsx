import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/client';
import { IndianRupee, ShoppingBag, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

function Stat({ label, value, icon: Icon, sub, color = 'text-brand-500' }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg bg-gray-50 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  () => reportsApi.dashboard({ date: today }).then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: dailyData } = useQuery({
    queryKey: ['daily-sales', today],
    queryFn:  () => reportsApi.dailySales({ date: today }).then(r => r.data),
  });

  if (isLoading) return (
    <div className="p-8 text-gray-400">Loading dashboard…</div>
  );

  const modes = dailyData?.payment_modes || {};

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Today's Sales"   value={fmt(data?.today?.sales)}     icon={IndianRupee}  />
        <Stat label="Bills Today"     value={data?.today?.count ?? 0}     icon={ShoppingBag}  sub={`Avg ${fmt(data?.today?.avg_bill)}`} />
        <Stat label="Collected"       value={fmt(data?.today?.collected)} icon={TrendingUp}   color="text-green-600" />
        <Stat label="Outstanding"     value={fmt(data?.today?.outstanding)} icon={Clock}      color="text-amber-600" />
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Month Sales"    value={fmt(data?.month?.sales)}      icon={IndianRupee}  color="text-blue-600" />
        <Stat label="Month Bills"    value={data?.month?.count ?? 0}      icon={ShoppingBag}  color="text-blue-600" />
        <Stat label="Discounts"      value={fmt(data?.month?.discounts)}  icon={TrendingUp}   color="text-orange-600" />
        <Stat label="Low Stock SKUs" value={data?.low_stock ?? 0}         icon={AlertTriangle} color="text-red-600" />
      </div>

      {/* Payment mode breakdown */}
      {Object.keys(modes).length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Today's Collections by Mode</h2>
          <div className="flex flex-wrap gap-4">
            {Object.entries(modes).map(([mode, total]) => (
              <div key={mode} className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{mode}</p>
                <p className="text-lg font-semibold text-gray-900">{fmt(total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bills table */}
      {dailyData?.bills?.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Today's Bills</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-xs font-medium text-gray-500">Bill #</th>
                  <th className="pb-2 text-xs font-medium text-gray-500">Customer</th>
                  <th className="pb-2 text-xs font-medium text-gray-500">Staff</th>
                  <th className="pb-2 text-xs font-medium text-gray-500 text-right">Total</th>
                  <th className="pb-2 text-xs font-medium text-gray-500 text-right">Paid</th>
                  <th className="pb-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dailyData.bills.map(b => (
                  <tr key={b.id}>
                    <td className="py-2 font-mono text-xs">{b.bill_number}</td>
                    <td className="py-2">{b.customer?.name ?? b.walk_in_name ?? 'Walk-in'}</td>
                    <td className="py-2 text-gray-500">{b.creator?.name}</td>
                    <td className="py-2 text-right">{fmt(b.total_amount)}</td>
                    <td className="py-2 text-right">{fmt(b.amount_paid)}</td>
                    <td className="py-2">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    draft:   'bg-gray-100 text-gray-600',
    posted:  'bg-blue-100 text-blue-700',
    paid:    'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    void:    'bg-red-100 text-red-700',
    refunded:'bg-purple-100 text-purple-700',
  };
  return <span className={`badge ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>{status}</span>;
}
