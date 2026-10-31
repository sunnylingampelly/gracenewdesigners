import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/client';
import {
  IndianRupee, ShoppingBag, TrendingUp, TrendingDown,
  Clock, Users, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  format, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, subMonths, subQuarters,
} from 'date-fns';
import clsx from 'clsx';

const fmt  = n  => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const pct  = (cur, prev) => {
  const p = ((cur - prev) / Math.max(prev, 1)) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
};
const istDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const PRESETS = ['Today','Yesterday','This Week','This Month','Last Month','This Quarter','This Year','Custom'];

function getRange(preset) {
  const today = istDate();
  const now   = new Date(today);
  switch (preset) {
    case 'Today':        return [today, today];
    case 'Yesterday':    { const d = format(subDays(now,1),'yyyy-MM-dd'); return [d,d]; }
    case 'This Week':    return [format(startOfWeek(now,{weekStartsOn:1}),'yyyy-MM-dd'), format(endOfWeek(now,{weekStartsOn:1}),'yyyy-MM-dd')];
    case 'This Month':   return [format(startOfMonth(now),'yyyy-MM-dd'), format(endOfMonth(now),'yyyy-MM-dd')];
    case 'Last Month':   { const lm = subMonths(now,1); return [format(startOfMonth(lm),'yyyy-MM-dd'), format(endOfMonth(lm),'yyyy-MM-dd')]; }
    case 'This Quarter': return [format(startOfQuarter(now),'yyyy-MM-dd'), format(endOfQuarter(now),'yyyy-MM-dd')];
    case 'This Year':    return [format(startOfYear(now),'yyyy-MM-dd'), format(endOfYear(now),'yyyy-MM-dd')];
    default:             return [today, today];
  }
}

function PctBadge({ cur, prev }) {
  if (!prev && !cur) return null;
  const val = ((cur - prev) / Math.max(prev, 1)) * 100;
  const up  = val >= 0;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full', up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
      {up ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
      {Math.abs(val).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, prev, icon: Icon, iconColor = 'text-blue-600', sub }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        <div className={clsx('p-2 rounded-lg bg-gray-50', iconColor)}><Icon size={16}/></div>
      </div>
      <p className="text-2xl font-semibold text-gray-900 leading-none">{value}</p>
      <div className="flex items-center gap-2">
        {prev !== undefined && <PctBadge cur={Number(value?.toString().replace(/[₹,]/g,'')) || 0} prev={prev} />}
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function KpiCardRaw({ label, value, prevValue, icon: Icon, iconColor, sub }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        <div className={clsx('p-2 rounded-lg bg-gray-50', iconColor ?? 'text-blue-600')}><Icon size={16}/></div>
      </div>
      <p className="text-2xl font-semibold text-gray-900 leading-none">{value}</p>
      <div className="flex items-center gap-2">
        {prevValue !== undefined && <PctBadge cur={Number(value) || 0} prev={Number(prevValue) || 0} />}
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {[...Array(6)].map((_,i) => (
        <div key={i} className="card animate-pulse h-28 bg-gray-100" />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [preset,     setPreset]     = useState('Today');
  const [customFrom, setCustomFrom] = useState(istDate());
  const [customTo,   setCustomTo]   = useState(istDate());

  const [dateFrom, dateTo] = useMemo(() => {
    if (preset === 'Custom') return [customFrom, customTo];
    return getRange(preset);
  }, [preset, customFrom, customTo]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-v2', dateFrom, dateTo],
    queryFn:  () => reportsApi.dashboard({ date_from: dateFrom, date_to: dateTo }).then(r => r.data),
    staleTime: 30_000,
  });

  const trendData = useMemo(() =>
    (data?.trend ?? []).map(t => ({
      label: format(new Date(t.date), 'd MMM'),
      sales: Number(t.sales),
      bills: Number(t.count),
    })),
    [data]
  );

  const totalModes = Object.values(data?.payment_modes ?? {}).reduce((s,v) => s + Number(v), 0);

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">

      {/* Header + preset toolbar */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400">{format(new Date(), 'EEEE, d MMMM yyyy')} · IST</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setPreset(p)}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                preset === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600')}>
              {p}
            </button>
          ))}
        </div>
        {preset === 'Custom' && (
          <div className="flex gap-3 items-end flex-wrap">
            <div><label className="label">From</label>
              <input type="date" className="input w-40 text-sm" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)} max={customTo} /></div>
            <div><label className="label">To</label>
              <input type="date" className="input w-40 text-sm" value={customTo}
                onChange={e => setCustomTo(e.target.value)} min={customFrom} /></div>
          </div>
        )}
        {dateFrom !== dateTo && (
          <p className="text-xs text-gray-400">{dateFrom} → {dateTo}</p>
        )}
      </div>

      {/* KPI cards */}
      {isLoading ? <Skeleton /> : isError ? (
        <p className="text-sm text-red-500">Failed to load dashboard data.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCardRaw label="Total Sales"   value={fmt(data.sales)}       prevValue={data.prev_sales} icon={IndianRupee} iconColor="text-blue-600" />
          <KpiCardRaw label="Bills"         value={data.count}            prevValue={data.prev_count} icon={ShoppingBag} iconColor="text-indigo-600" />
          <KpiCardRaw label="Avg Bill"      value={fmt(data.avg_bill)}    icon={TrendingUp}   iconColor="text-cyan-600" sub="per transaction" />
          <KpiCardRaw label="Collected"     value={fmt(data.collected)}   icon={CheckCircle}  iconColor="text-green-600" />
          <KpiCardRaw label="Outstanding"   value={fmt(data.outstanding)} icon={Clock}        iconColor="text-amber-600" />
          <KpiCardRaw label="New Customers" value={data.new_customers}    icon={Users}        iconColor="text-purple-600" sub="in period" />
        </div>
      )}

      {/* Sales Trend */}
      {!isLoading && trendData.length > 1 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Sales Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={60} />
              <Tooltip formatter={(v) => [fmt(v), 'Sales']} labelStyle={{ fontSize: 12 }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Line type="monotone" dataKey="sales" stroke="#1565C0" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Middle row: Payment modes + Top Products */}
      {!isLoading && data && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Payment mode breakdown */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Collections by Payment Mode</h2>
            {Object.keys(data.payment_modes ?? {}).length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No payments in this period</p>
            ) : Object.entries(data.payment_modes).map(([mode, total]) => {
              const pct = totalModes > 0 ? ((Number(total) / totalModes) * 100).toFixed(0) : 0;
              return (
                <div key={mode}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-gray-600 font-medium">{mode}</span>
                    <span className="text-gray-500">{fmt(total)} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Products */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Products</h2>
            {data.top_products?.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No sales in this period</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-gray-400 font-medium">Product</th>
                  <th className="pb-2 text-gray-400 font-medium text-right">Qty</th>
                  <th className="pb-2 text-gray-400 font-medium text-right">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.top_products?.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium text-gray-800 max-w-[140px] truncate">{p.name}</td>
                      <td className="py-2 text-right text-gray-500">{p.qty_sold}</td>
                      <td className="py-2 text-right font-medium">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Bottom row: Top Staff + Low Stock */}
      {!isLoading && data && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Top Staff */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Staff Performance</h2>
            {data.top_staff?.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No activity in this period</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-gray-400 font-medium">Staff</th>
                  <th className="pb-2 text-gray-400 font-medium text-right">Bills</th>
                  <th className="pb-2 text-gray-400 font-medium text-right">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.top_staff?.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium text-gray-800">{s.name}</td>
                      <td className="py-2 text-right text-gray-500">{s.bills}</td>
                      <td className="py-2 text-right font-medium">{fmt(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className={clsx('card', data.low_stock?.length > 0 ? 'border-red-200' : 'border-green-200')}>
            <div className="flex items-center gap-2 mb-3">
              {data.low_stock?.length > 0
                ? <AlertTriangle size={15} className="text-red-500" />
                : <CheckCircle size={15} className="text-green-500" />}
              <h2 className="text-sm font-semibold text-gray-700">
                {data.low_stock?.length > 0 ? `Low Stock (${data.low_stock_count} SKUs)` : 'Stock Healthy'}
              </h2>
            </div>
            {data.low_stock?.length === 0 ? (
              <p className="text-xs text-green-600">All products are above reorder levels.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {data.low_stock?.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-gray-50">
                    <div>
                      <p className="font-medium text-gray-800">{s.product}</p>
                      <p className="text-gray-400 font-mono">{s.sku}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-red-600 font-semibold">{s.on_hand}</span>
                      <span className="text-gray-400"> / {s.reorder_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
