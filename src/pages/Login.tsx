import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Lock, User, LogIn, Loader2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Password Change Mode state
  const [changePasswordMode, setChangePasswordMode] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
    setLoginError(null);
    try {
      const res = await window.electronAPI.dbQuery('auth:login', { username, password });

      if (!res.success) {
        setLoginError('System Error: ' + res.error);
        return;
      }

      if (res.data) {
        // Check if password change is required
        if (res.data.must_change_password) {
          setTempUser(res.data);
          setChangePasswordMode(true);
          setNewPassword('');
          setConfirmPassword('');
          setPasswordError(null);
        } else {
          login(res.data);
          navigate('/dashboard');
        }
      } else {
        setLoginError('Incorrect username or password.');
      }
    } catch (err: any) {
      setLoginError('System connectivity error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return;

    setPasswordError(null);

    // Validation
    if (!newPassword || newPassword.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await window.electronAPI.dbQuery('auth:changePassword', {
        userId: tempUser.id,
        newPassword
      });

      if (res.success) {
        // Complete login
        const updatedUser = { ...tempUser, must_change_password: false };
        login(updatedUser);
        navigate('/dashboard');
      } else {
        setPasswordError(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setPasswordError('Connectivity error: ' + err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setChangePasswordMode(false);
    setTempUser(null);
    setLoginError('Password change required to proceed.');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 font-inter">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-10 text-center bg-white border-b border-slate-50">
          <img src="/login.png" alt="Logo" className="mx-auto mb-4 h-24 object-contain" />
          <h2 className="text-xl font-bold text-[#00167a] tracking-tight uppercase leading-none">D.CHEMIST</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 opacity-70">Pharmacy Management System</p>
        </div>

        {changePasswordMode ? (
          <form onSubmit={handleChangePasswordSubmit} className="p-8 space-y-6">
            <div className="text-center">
              <h3 className="text-sm font-bold text-[#00167a] uppercase tracking-wider">Change Password</h3>
              <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mt-1">Security Enforcement</p>
            </div>

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold text-center">
                {passwordError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input
                    type="password"
                    placeholder="Enter new password (min 6 chars)"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#00167a]"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#00167a]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full bg-[#00167a] hover:bg-[#000c4d] text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-[#00167a]/10 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Update & Login</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelPasswordChange}
                disabled={isChangingPassword}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold text-center">
                {loginError}
              </div>
            )}

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
        )}
      </div>
    </div>
  );
}