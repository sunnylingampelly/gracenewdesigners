import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0C0B] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-[#F0EAE0] font-light">Grace New Designers</h1>
          <p className="text-xs text-[#7A746E] mt-2 uppercase tracking-widest">Staff Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#161412] border border-[#262220] rounded-lg p-8 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="label text-[#7A746E]">Email</label>
            <input
              type="email" required
              className="input bg-[#1E1B18] border-[#262220] text-[#F0EAE0] focus:ring-brand-500"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label text-[#7A746E]">Password</label>
            <input
              type="password" required
              className="input bg-[#1E1B18] border-[#262220] text-[#F0EAE0] focus:ring-brand-500"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full btn-primary justify-center py-2.5 mt-2 disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
