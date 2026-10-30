import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/client';
import { format } from 'date-fns';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function Reports() {
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: daily } = useQuery({
    queryKey: ['report-daily', date],
    queryFn:  () => reportsApi.dailySales({ date }).then(r => r.data),
    enabled:  tab === 'daily',
  });

  const { data: stock } = useQuery({
    queryKey: ['stock-on-hand'],
    queryFn:  () => reportsApi.stockOnHand({ per_page: 200 }).then(r => r.data.data),
    enabled:  tab === 'stock',
  });

  const { data: outstanding } = useQuery({
    queryKey: ['outstanding'],
    queryFn:  () => reportsApi.outstanding().then(r => r.data),
    enabled:  tab === 'outstanding',
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff-activity'],
    queryFn:  () => reportsApi.staffActivity().then(r => r.data),
    enabled:  tab === 'staff',
  });

  const tabs = [
    { id: 'daily',       label: 'Daily Sales' },
    { id: 'stock',       label: 'Stock on Hand' },
    { id: 'outstanding', label: 'Receivables' },
    { id: 'staff',       label: 'Staff Activity' },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <div className="space-y-4">
          <input type="date" className="input w-44 text-sm" value={date} onChange={e => setDate(e.target.value)} />
          {daily && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ['Gross Sales',  daily.gross_sales],
                  ['Discounts',    daily.discounts],
                  ['Net Sales',    daily.net_sales],
                  ['Bills',        daily.bill_count],
                ].map(([l, v]) => (
                  <div key={l} className="card">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{l}</p>
                    <p className="text-2xl font-semibold mt-1">{typeof v === 'number' && v > 100 ? fmt(v) : v}</p>
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
          )}
        </div>
      )}

      {tab === 'stock' && stock && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                {['SKU','Product','Category','On Hand','Available','Damaged','Value'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stock.map(v => (
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
            </tbody>
          </table>
        </div>
      )}

      {tab === 'outstanding' && outstanding && (
        <div className="space-y-4">
          <div className="card inline-block">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Outstanding</p>
            <p className="text-2xl font-semibold">{fmt(outstanding.total_due)}</p>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left">
                  {['Bill #','Customer','Date','Days','Total','Paid','Due','Staff'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {outstanding.bills.map((b, i) => (
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
      )}

      {tab === 'staff' && staffData && (
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
              {staffData.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{s.role}</td>
                  <td className="px-4 py-2 text-center">{s.bill_count}</td>
                  <td className="px-4 py-2 text-right">{fmt(s.total_sales)}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{fmt(s.total_discounts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
