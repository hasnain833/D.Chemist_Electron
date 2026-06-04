import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Lock, User, LogIn, Loader2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Use the dedicated login handler which handles bcrypt verification in the backend
      const res = await window.electronAPI.dbQuery('auth:login', { username, password });

      if (!res.success) {
        alert('System Error: ' + res.error);
        return;
      }

      if (res.data) {
        login(res.data);
        // Navigate to dashboard upon successful login
        navigate('/dashboard');
      } else {
        alert('Incorrect username or password.');
      }
    } catch (err: any) {
      alert('System connectivity error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 font-inter">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-10 text-center bg-white border-b border-slate-50">
          <img src="/login.png" alt="Logo" className="mx-auto mb-4 h-24 object-contain" />
          <h2 className="text-xl font-bold text-[#00167a] tracking-tight uppercase leading-none">D.CHEMIST</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 opacity-70">Pharmacy Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  ref={usernameRef}
                  type="text"
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#00167a]"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  type="password"
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#00167a]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#00167a] hover:bg-[#000c4d] text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-[#00167a]/10 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Login</span>
              </>
            )}
          </button>

          <div className="pt-5 text-center border-t border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">D.Chemist Software v2.0</p>
          </div>
        </form>
      </div>
    </div>
  );
}