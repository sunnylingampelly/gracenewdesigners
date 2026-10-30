import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi, suppliersApi } from '../../api/client';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
const STATUS = { draft:'bg-gray-100 text-gray-500', ordered:'bg-blue-100 text-blue-600', received:'bg-green-100 text-green-700', partial:'bg-amber-100 text-amber-700', cancelled:'bg-red-50 text-red-500' };

export default function Purchases() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['purchases', page],
    queryFn:  () => purchasesApi.list({ page }).then(r => r.data),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <button className="btn-primary"><Plus size={16} /> New Purchase</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left">
              {['Ref #','Supplier','Order Date','Items','Total','Status','Payment'].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.data?.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{p.reference_number}</td>
                <td className="px-4 py-3">{p.supplier?.name}</td>
                <td className="px-4 py-3 text-gray-500">{format(new Date(p.order_date), 'd MMM yy')}</td>
                <td className="px-4 py-3 text-center">{p.items?.length ?? '—'}</td>
                <td className="px-4 py-3 font-medium">{fmt(p.total_amount)}</td>
                <td className="px-4 py-3"><span className={`badge ${STATUS[p.status]}`}>{p.status}</span></td>
                <td className="px-4 py-3"><span className={`badge ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{p.payment_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
