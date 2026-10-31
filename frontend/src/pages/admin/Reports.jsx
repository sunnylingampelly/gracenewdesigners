import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/client';
import { Download } from 'lucide-react';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

function getISTDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function exportCSV(filename, headers, rows) {
  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map(r => r.map(escape).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const today = getISTDate();
const firstOfMonth = today.slice(0, 8) + '01';

export default function Reports() {
  const [tab,      setTab]      = useState('daily');
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate,   setToDate]   = useState(today);

  // Single date for daily tab
  const [date, setDate] = useState(today);

  const { data: daily } = useQuery({
    queryKey: ['report-daily', date],
    queryFn:  () => reportsApi.dailySales({ date }).then(r => r.data),
    enabled:  tab === 'daily',
  });

  const { data: stock } = useQuery({
    queryKey: ['stock-on-hand', fromDate, toDate],
    queryFn:  () => reportsApi.stockOnHand({ per_page: 500 }).then(r => r.data.data ?? r.data),
    enabled:  tab === 'stock',
  });

  const { data: outstanding } = useQuery({
    queryKey: ['outstanding', fromDate, toDate],
    queryFn:  () => reportsApi.outstanding({ from: fromDate, to: toDate }).then(r => r.data),
    enabled:  tab === 'outstanding',
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff-activity', fromDate, toDate],
    queryFn:  () => reportsApi.staffActivity({ from: fromDate, to: toDate }).then(r => r.data),
    enabled:  tab === 'staff',
  });

  const { data: purchasesData } = useQuery({
    queryKey: ['report-purchases', fromDate, toDate],
    queryFn:  () => reportsApi.purchases({ from: fromDate, to: toDate, per_page: 500 }).then(r => r.data.data ?? r.data),
    enabled:  tab === 'purchases',
  });

  const tabs = [
    { id: 'daily',       label: 'Daily Sales'   },
    { id: 'stock',       label: 'Stock on Hand' },
    { id: 'outstanding', label: 'Receivables'   },
    { id: 'purchases',   label: 'Purchases'     },
    { id: 'staff',       label: 'Staff Activity'},
  ];

  // ── Export helpers ───────────────────────────────────────
  function exportStock() {
    if (!stock) return;
    exportCSV(`stock-${today}.csv`,
      ['SKU', 'Product', 'Category', 'On Hand', 'Reserved', 'Available', 'Damaged', 'Cost Price', 'Value'],
      stock.map(v => [
        v.sku, v.product?.name, v.product?.category?.name,
        v.qty_on_hand, v.qty_reserved, v.qty_on_hand - v.qty_reserved,
        v.qty_damaged, v.cost_price ?? 0,
        (v.qty_on_hand * (v.cost_price || 0)).toFixed(0),
      ])
    );
  }

  function exportOutstanding() {
    if (!outstanding?.bills) return;
    exportCSV(`receivables-${fromDate}-to-${toDate}.csv`,
      ['Bill #', 'Customer', 'Date', 'Days Overdue', 'Total', 'Paid', 'Due', 'Staff'],
      outstanding.bills.map(b => [
        b.bill_number, b.customer, b.bill_date, b.days_overdue,
        b.total, b.paid, b.due, b.staff,
      ])
    );
  }

  function exportPurchases() {
    if (!purchasesData) return;
    exportCSV(`purchases-${fromDate}-to-${toDate}.csv`,
      ['Ref #', 'Supplier', 'Order Date', 'Items', 'Total', 'Status', 'Payment'],
      purchasesData.map(p => [
        p.reference_number, p.supplier?.name, p.order_date,
        p.items?.length ?? '', p.total_amount, p.status, p.payment_status,
      ])
    );
  }

  function exportStaff() {
    if (!staffData) return;
    exportCSV(`staff-${fromDate}-to-${toDate}.csv`,
      ['Name', 'Role', 'Bills', 'Total Sales', 'Discounts'],
      staffData.map(s => [s.name, s.role, s.bill_count, s.total_sales, s.total_discounts])
    );
  }

  function exportDaily() {
    if (!daily) return;
    const rows = [
      ['Gross Sales', daily.gross_sales],
      ['Discounts', daily.discounts],
      ['Net Sales', daily.net_sales],
      ['Bills Count', daily.bill_count],
      ...Object.entries(daily.payment_modes ?? {}).map(([m, v]) => [`Payment - ${m}`, v]),
    ];
    exportCSV(`daily-sales-${date}.csv`, ['Metric', 'Value'], rows);
  }

  const showDateRange = tab !== 'daily';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        {tab === 'daily' ? (
          <div>
            <label className="label">Date</label>
            <input type="date" className="input w-40 text-sm" value={date}
              onChange={e => setDate(e.target.value)} max={today} />
          </div>
        ) : (
          <>
            <div>
              <label className="label">From</label>
              <input type="date" className="input w-40 text-sm" value={fromDate}
                onChange={e => setFromDate(e.target.value)} max={toDate} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input w-40 text-sm" value={toDate}
                onChange={e => setToDate(e.target.value)} min={fromDate} max={today} />
            </div>
            <div className="flex gap-2">
              {[
                ['Today',     today, today],
                ['This month',firstOfMonth, today],
                ['Last 7d',  new Date(Date.now()-6*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}), today],
              ].map(([label, f, t]) => (
                <button key={label} onClick={() => { setFromDate(f); setToDate(t); }}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Daily Sales ── */}
      {tab === 'daily' && (
        <div className="space-y-4">
          {daily ? (
            <>
              <div className="flex justify-end">
                <button onClick={exportDaily} className="btn-secondary flex items-center gap-2 text-xs">
                  <Download size={13} /> Export CSV
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ['Gross Sales',  daily.gross_sales],
                  ['Discounts',    daily.discounts],
                  ['Net Sales',    daily.net_sales],
                  ['Bills',        daily.bill_count],
                ].map(([l, v]) => (
                  <div key={l} className="card">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{l}</p>
                    <p className="text-2xl font-semibold mt-1">{typeof v === 'number' && v > 999 ? fmt(v) : v}</p>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Collections by Payment Mode</h3>
                <div className="flex gap-8 flex-wrap">
                  {Object.entries(daily.payment_modes ?? {}).map(([mode, total]) => (
                    <div key={mode}>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">{mode}</p>
                      <p className="text-lg font-semibold">{fmt(total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : <p className="text-sm text-gray-400 py-6 text-center">No data for this date.</p>}
        </div>
      )}

      {/* ── Stock on Hand ── */}
      {tab === 'stock' && (
        <div className="space-y-3">
          {stock && (
            <div className="flex justify-end">
              <button onClick={exportStock} className="btn-secondary flex items-center gap-2 text-xs">
                <Download size={13} /> Export CSV
              </button>
            </div>
          )}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left">
                    {['SKU','Product','Category','On Hand','Available','Damaged','Value'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stock?.map(v => (
                    <tr key={v.id}>
                      <td className="px-4 py-2 font-mono text-xs">{v.sku}</td>
                      <td className="px-4 py-2">{v.product?.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{v.product?.category?.name}</td>
                      <td className="px-4 py-2 text-right">{v.qty_on_hand}</td>
                      <td className="px-4 py-2 text-right">{v.qty_on_hand - v.qty_reserved}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{v.qty_damaged}</td>
                      <td className="px-4 py-2 text-right">{fmt(v.qty_on_hand * (v.cost_price || 0))}</td>
                    </tr>
                  ))}
                  {!stock && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Receivables ── */}
      {tab === 'outstanding' && (
        <div className="space-y-4">
          {outstanding && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="card inline-block">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Outstanding</p>
                  <p className="text-2xl font-semibold">{fmt(outstanding.total_due)}</p>
                </div>
                <button onClick={exportOutstanding} className="btn-secondary flex items-center gap-2 text-xs">
                  <Download size={13} /> Export CSV
                </button>
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50 border-b">
                      <tr className="text-left">
                        {['Bill #','Customer','Date','Days','Total','Paid','Due','Staff'].map(h => (
                          <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {outstanding.bills?.map((b, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-mono text-xs">{b.bill_number}</td>
                          <td className="px-4 py-2">{b.customer}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{b.bill_date}</td>
                          <td className="px-4 py-2 text-center">{b.days_overdue}</td>
                          <td className="px-4 py-2 text-right">{fmt(b.total)}</td>
                          <td className="px-4 py-2 text-right text-green-700">{fmt(b.paid)}</td>
                          <td className="px-4 py-2 text-right text-red-700 font-medium">{fmt(b.due)}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{b.staff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Purchases ── */}
      {tab === 'purchases' && (
        <div className="space-y-3">
          {purchasesData && (
            <div className="flex justify-end">
              <button onClick={exportPurchases} className="btn-secondary flex items-center gap-2 text-xs">
                <Download size={13} /> Export CSV
              </button>
            </div>
          )}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left">
                    {['Ref #','Supplier','Order Date','Items','Total','Status','Payment'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchasesData?.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-mono text-xs font-medium">{p.reference_number}</td>
                      <td className="px-4 py-2">{p.supplier?.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{p.order_date}</td>
                      <td className="px-4 py-2 text-center">{p.items?.length ?? '—'}</td>
                      <td className="px-4 py-2 font-medium">{fmt(p.total_amount)}</td>
                      <td className="px-4 py-2"><span className="badge bg-gray-100 text-gray-600">{p.status}</span></td>
                      <td className="px-4 py-2"><span className={`badge ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{p.payment_status}</span></td>
                    </tr>
                  ))}
                  {!purchasesData && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Staff Activity ── */}
      {tab === 'staff' && (
        <div className="space-y-3">
          {staffData && (
            <div className="flex justify-end">
              <button onClick={exportStaff} className="btn-secondary flex items-center gap-2 text-xs">
                <Download size={13} /> Export CSV
              </button>
            </div>
          )}
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left">
                  {['Name','Role','Bills','Total Sales','Discounts'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffData?.map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{s.role}</td>
                    <td className="px-4 py-2 text-center">{s.bill_count}</td>
                    <td className="px-4 py-2 text-right">{fmt(s.total_sales)}</td>
                    <td className="px-4 py-2 text-right text-amber-600">{fmt(s.total_discounts)}</td>
                  </tr>
                ))}
                {!staffData && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
