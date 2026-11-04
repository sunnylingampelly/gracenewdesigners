import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/client';
import {
  IndianRupee, ShoppingBag, TrendingUp, CheckCircle,
  Clock, Users, ArrowUpRight, ArrowDownRight, Trophy,
  Zap, Star, Target, Flame,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  format, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, subMonths,
} from 'date-fns';
import clsx from 'clsx';

/* ─── helpers ─────────────────────────────────────────────────────── */
const fmt  = n  => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
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

/* ─── animated counter hook ───────────────────────────────────────── */
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === 0 || target === undefined || target === null) { setValue(0); return; }
    const start  = performance.now();
    const from   = 0;
    const to     = Number(target) || 0;

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (to - from) * ease));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ─── pct badge ───────────────────────────────────────────────────── */
function PctBadge({ cur, prev }) {
  if (!prev && !cur) return null;
  const val = ((cur - prev) / Math.max(prev, 1)) * 100;
  const up  = val >= 0;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full',
      up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
      {up ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
      {Math.abs(val).toFixed(1)}%
    </span>
  );
}

/* ─── animated KPI card ───────────────────────────────────────────── */
function KpiCard({ label, rawValue, prevValue, isCurrency, icon: Icon, gradient, delay = 0, pulse }) {
  const animated = useCountUp(rawValue);
  const display  = isCurrency ? fmt(animated) : animated;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-white/60"
      style={{
        background: gradient,
        animation: `slideUp 0.5s ease-out ${delay}ms both`,
      }}
    >
      {/* glow dot */}
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20"
           style={{ background: 'white', filter: 'blur(16px)' }} />

      <div className="flex items-center justify-between relative z-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
          <Icon size={15} className="text-white" />
        </div>
      </div>

      <div className="relative z-10">
        <p className={clsx('font-bold text-white leading-none', isCurrency ? 'text-xl' : 'text-3xl')}>
          {display}
        </p>
      </div>

      <div className="flex items-center gap-2 relative z-10">
        {prevValue !== undefined && (
          <PctBadge
            cur={rawValue}
            prev={prevValue}
          />
        )}
        {pulse && rawValue > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            live
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── staff leaderboard ────────────────────────────────────────────── */
const MEDALS = ['🥇','🥈','🥉'];
const MEDAL_BG = [
  'from-amber-50 to-amber-100 border-amber-200',
  'from-slate-50 to-slate-100 border-slate-200',
  'from-orange-50 to-orange-100 border-orange-200',
];

function StaffLeaderboard({ staff }) {
  const max = Math.max(...(staff?.map(s => Number(s.revenue)) ?? [1]), 1);

  return (
    <div className="card" style={{ animation: 'slideUp 0.5s ease-out 400ms both' }}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={15} className="text-amber-500" />
        <h2 className="text-sm font-bold text-gray-800">Staff Leaderboard</h2>
      </div>

      {!staff?.length ? (
        <p className="text-xs text-gray-400 py-6 text-center">No activity in this period</p>
      ) : (
        <div className="space-y-3">
          {staff.map((s, i) => {
            const pct = (Number(s.revenue) / max) * 100;
            return (
              <div key={i}
                className={clsx('rounded-xl p-3 border bg-gradient-to-r', MEDAL_BG[i] ?? 'from-gray-50 to-gray-100 border-gray-200')}
                style={{ animation: `slideUp 0.4s ease-out ${200 + i * 80}ms both` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{MEDALS[i] ?? `#${i+1}`}</span>
                    <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-800">{fmt(s.revenue)}</p>
                    <p className="text-[10px] text-gray-500">{s.bills} bills</p>
                  </div>
                </div>
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: i === 0 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : i === 1 ? 'linear-gradient(90deg,#94a3b8,#cbd5e1)' : 'linear-gradient(90deg,#f97316,#fb923c)',
                      transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
                      transitionDelay: `${300 + i * 100}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── payment mode bars ───────────────────────────────────────────── */
const MODE_COLORS = {
  cash:   'linear-gradient(90deg,#10b981,#34d399)',
  upi:    'linear-gradient(90deg,#6366f1,#818cf8)',
  card:   'linear-gradient(90deg,#3b82f6,#60a5fa)',
  credit: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
  cheque: 'linear-gradient(90deg,#8b5cf6,#a78bfa)',
};

function PaymentModes({ modes }) {
  const total = Object.values(modes ?? {}).reduce((s,v) => s + Number(v), 0);

  return (
    <div className="card" style={{ animation: 'slideUp 0.5s ease-out 300ms both' }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap size={15} className="text-blue-500" />
        <h2 className="text-sm font-bold text-gray-800">Collections by Mode</h2>
      </div>

      {!Object.keys(modes ?? {}).length ? (
        <p className="text-xs text-gray-400 py-6 text-center">No payments in this period</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(modes).map(([mode, amount], i) => {
            const pct = total > 0 ? ((Number(amount) / total) * 100).toFixed(0) : 0;
            return (
              <div key={mode} style={{ animation: `slideUp 0.4s ease-out ${150 + i * 60}ms both` }}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="capitalize font-semibold text-gray-700">{mode}</span>
                  <span className="text-gray-500">{fmt(amount)} · <span className="font-bold text-gray-700">{pct}%</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: MODE_COLORS[mode] ?? 'linear-gradient(90deg,#6b7280,#9ca3af)',
                      transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)',
                      transitionDelay: `${400 + i * 80}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── top products ─────────────────────────────────────────────────── */
function TopProducts({ products }) {
  const max = Math.max(...(products?.map(p => Number(p.revenue)) ?? [1]), 1);

  return (
    <div className="card" style={{ animation: 'slideUp 0.5s ease-out 350ms both' }}>
      <div className="flex items-center gap-2 mb-4">
        <Star size={15} className="text-purple-500" />
        <h2 className="text-sm font-bold text-gray-800">Top Products</h2>
      </div>

      {!products?.length ? (
        <p className="text-xs text-gray-400 py-6 text-center">No sales in this period</p>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => {
            const pct = (Number(p.revenue) / max) * 100;
            return (
              <div key={i} style={{ animation: `slideUp 0.4s ease-out ${150 + i * 60}ms both` }}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-800 truncate max-w-[180px]">{p.name}</span>
                  <span className="text-gray-500 shrink-0 ml-2">{fmt(p.revenue)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `hsl(${260 + i * 20},70%,60%)`,
                      transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
                      transitionDelay: `${300 + i * 70}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── skeleton ─────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_,i) => (
          <div key={i} className="h-28 rounded-2xl animate-pulse bg-gradient-to-br from-gray-200 to-gray-100" />
        ))}
      </div>
      <div className="h-56 rounded-2xl animate-pulse bg-gray-100" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl animate-pulse bg-gray-100" />
        <div className="h-48 rounded-2xl animate-pulse bg-gray-100" />
      </div>
    </div>
  );
}

/* ─── custom tooltip for chart ─────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600 font-bold">{fmt(payload[0]?.value)}</p>
      {payload[1] && <p className="text-gray-400">{payload[1]?.value} bills</p>}
    </div>
  );
}

/* ─── main component ───────────────────────────────────────────────── */
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

  // headline stats for gamification
  const collectionRate = data?.sales > 0
    ? Math.round((Number(data.collected) / Number(data.sales)) * 100)
    : 0;

  return (
    <>
      {/* keyframe animations */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes countPulse {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .recharts-area-curve { animation: fadeIn 1s ease-out; }
      `}</style>

      <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-8"
           style={{ animation: 'fadeIn 0.3s ease-out' }}>

        {/* ── Header ── */}
        <div className="flex flex-col gap-3" style={{ animation: 'slideUp 0.4s ease-out both' }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Flame size={20} className="text-orange-500" />
                Dashboard
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')} · IST</p>
            </div>

            {/* Collection rate badge */}
            {data && collectionRate > 0 && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-3 py-2"
                   style={{ animation: 'slideUp 0.5s ease-out 200ms both' }}>
                <Target size={14} className="text-emerald-600" />
                <div>
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Collection Rate</p>
                  <p className="text-sm font-bold text-emerald-700">{collectionRate}%</p>
                </div>
              </div>
            )}
          </div>

          {/* Preset pills */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <button key={p} onClick={() => setPreset(p)}
                style={{ animation: `slideUp 0.4s ease-out ${i * 40}ms both` }}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border',
                  preset === p
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 scale-105'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600 hover:scale-105'
                )}>
                {p}
              </button>
            ))}
          </div>

          {preset === 'Custom' && (
            <div className="flex gap-3 items-end flex-wrap" style={{ animation: 'slideUp 0.3s ease-out both' }}>
              <div><label className="label">From</label>
                <input type="date" className="input w-40 text-sm" value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)} max={customTo} /></div>
              <div><label className="label">To</label>
                <input type="date" className="input w-40 text-sm" value={customTo}
                  onChange={e => setCustomTo(e.target.value)} min={customFrom} /></div>
            </div>
          )}
        </div>

        {/* ── KPI Grid ── */}
        {isLoading ? <Skeleton /> : isError ? (
          <p className="text-sm text-red-500 p-4 bg-red-50 rounded-xl">Failed to load dashboard data.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Total Sales"   rawValue={Number(data.sales)}         prevValue={Number(data.prev_sales)}  isCurrency icon={IndianRupee} delay={0}   pulse
                gradient="linear-gradient(135deg,#1565C0 0%,#1976D2 60%,#1E88E5 100%)" />
              <KpiCard label="Bills"         rawValue={Number(data.count)}          prevValue={Number(data.prev_count)} icon={ShoppingBag} delay={60}
                gradient="linear-gradient(135deg,#4f46e5 0%,#6366f1 60%,#818cf8 100%)" />
              <KpiCard label="Avg Bill"      rawValue={Number(data.avg_bill)}       isCurrency icon={TrendingUp} delay={120}
                gradient="linear-gradient(135deg,#0891b2 0%,#06b6d4 60%,#22d3ee 100%)" />
              <KpiCard label="Collected"     rawValue={Number(data.collected)}      isCurrency icon={CheckCircle} delay={180}
                gradient="linear-gradient(135deg,#059669 0%,#10b981 60%,#34d399 100%)" />
              <KpiCard label="Outstanding"   rawValue={Number(data.outstanding)}    isCurrency icon={Clock} delay={240}
                gradient={Number(data.outstanding) > 0
                  ? "linear-gradient(135deg,#b45309 0%,#d97706 60%,#f59e0b 100%)"
                  : "linear-gradient(135deg,#4b5563 0%,#6b7280 60%,#9ca3af 100%)"} />
              <KpiCard label="New Customers" rawValue={Number(data.new_customers)}  icon={Users} delay={300}
                gradient="linear-gradient(135deg,#7c3aed 0%,#8b5cf6 60%,#a78bfa 100%)" />
            </div>

            {/* ── Collection progress bar ── */}
            {data.sales > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                   style={{ animation: 'slideUp 0.5s ease-out 320ms both' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                    <Zap size={12} className="text-blue-500" />
                    Collections vs Billed
                  </span>
                  <span className="text-xs font-bold text-gray-800">{collectionRate}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      width: `${collectionRate}%`,
                      background: collectionRate >= 90
                        ? 'linear-gradient(90deg,#059669,#10b981)'
                        : collectionRate >= 60
                        ? 'linear-gradient(90deg,#d97706,#f59e0b)'
                        : 'linear-gradient(90deg,#dc2626,#ef4444)',
                      transition: 'width 1.5s cubic-bezier(0.34,1.56,0.64,1)',
                      transitionDelay: '500ms',
                    }}
                  >
                    {/* shimmer effect */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.4) 50%,transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s infinite',
                    }} />
                  </div>
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-gray-400">Collected: {fmt(data.collected)}</span>
                  <span className="text-[10px] text-gray-400">Billed: {fmt(data.sales)}</span>
                </div>
              </div>
            )}

            {/* ── Sales Trend Chart ── */}
            {trendData.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                   style={{ animation: 'slideUp 0.5s ease-out 380ms both' }}>
                <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={15} className="text-blue-500" />
                  Sales Trend
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1565C0" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1565C0" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v}
                           tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="sales" stroke="#1565C0" strokeWidth={2.5}
                          fill="url(#salesGrad)" dot={false}
                          activeDot={{ r: 5, fill: '#1565C0', strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Middle row ── */}
            <div className="grid md:grid-cols-2 gap-4">
              <PaymentModes modes={data.payment_modes ?? {}} />
              <TopProducts products={data.top_products ?? []} />
            </div>

            {/* ── Bottom row ── */}
            <div className="grid md:grid-cols-2 gap-4">
              <StaffLeaderboard staff={data.top_staff ?? []} />

              {/* Outstanding panel */}
              <div className={clsx(
                'card border-2',
                Number(data.outstanding) > 0 ? 'border-amber-200' : 'border-emerald-200'
              )} style={{ animation: 'slideUp 0.5s ease-out 450ms both' }}>
                <div className="flex items-center gap-2 mb-4">
                  {Number(data.outstanding) > 0
                    ? <Clock size={15} className="text-amber-500" />
                    : <CheckCircle size={15} className="text-emerald-500" />}
                  <h2 className="text-sm font-bold text-gray-800">
                    {Number(data.outstanding) > 0 ? 'Outstanding Balance' : 'All Collected'}
                  </h2>
                </div>

                {Number(data.outstanding) > 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">{fmt(data.outstanding)}</p>
                      <p className="text-xs text-amber-600 mt-1">pending collection</p>
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      {collectionRate}% of billed amount collected
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-6 text-center">
                    <p className="text-3xl mb-2">🎉</p>
                    <p className="text-sm font-bold text-emerald-700">Perfect Collection!</p>
                    <p className="text-xs text-emerald-600 mt-1">All billed amounts have been collected.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
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
