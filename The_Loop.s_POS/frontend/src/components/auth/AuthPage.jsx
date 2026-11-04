import React, { useState, useEffect, useCallback } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  Lock, 
  Mail, 
  Key, 
  Store, 
  Building2, 
  Phone, 
  MapPin, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Delete,
  KeyRound,
  Link2,
  Unlink
} from 'lucide-react';

export default function AuthPage() {
  const { 
    authView, 
    setAuthView, 
    login, 
    registerBusiness, 
    playBeep,
    orgStatus,
    refreshOrgStatus
  } = usePos();

  // Login form state
  const [loginMode, setLoginMode] = useState('CREDENTIALS'); // 'CREDENTIALS' or 'PIN'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Paired Company Terminal Context for Quick PIN Login
  const [pairedCompany, setPairedCompany] = useState(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('loops_paired_company') : null;
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [companyCodeInput, setCompanyCodeInput] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Business Registration form state
  const [regForm, setRegForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    country: 'Cambodia',
    defaultCurrency: 'USD'
  });

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    refreshOrgStatus();
  }, [refreshOrgStatus]);

  // Verify and pair terminal with company code
  const handleVerifyCompanyCode = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = companyCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Please enter your Company Code (e.g. BV-8821).');
      return;
    }
    setVerifyingCode(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/verify-company-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCode: cleanCode })
      });
      const data = await res.json();
      if (!res.ok || (!data.valid && !data.ok)) {
        throw new Error(data.error || 'Invalid code. Terminal could not be paired.');
      }
      const paired = {
        id: data.organization.id,
        name: data.organization.name,
        companyCode: data.organization.companyCode,
        currency: data.organization.currency || 'USD',
        storeId: data.organization.storeId || null,
        storeName: data.organization.storeName || null,
        storeCode: data.organization.storeCode || null
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('loops_paired_company', JSON.stringify(paired));
        localStorage.setItem('loops_selected_company_id', paired.id);
        if (paired.storeId) {
          localStorage.setItem('loops_selected_store_id', paired.storeId);
        }
      }
      setPairedCompany(paired);
      setCompanyCodeInput('');
      setPin('');
      setErrorMessage('');
      playBeep(880, 'sine', 0.1);
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed');
      playBeep(350, 'sawtooth', 0.2);
    } finally {
      setVerifyingCode(false);
    }
  };

  // Disconnect / Unpair terminal from current company
  const handleDisconnectCompany = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loops_paired_company');
      localStorage.removeItem('loops_selected_company_id');
    }
    setPairedCompany(null);
    setPin('');
    setErrorMessage('');
    playBeep(440, 'sine', 0.08);
  };

  // Submit PIN login to backend
  const executePinLogin = useCallback(async (pinToSubmit) => {
    if (!pairedCompany) {
      setErrorMessage('Terminal is not paired. Please enter your Company Code.');
      return;
    }
    setErrorMessage('');
    setLoading(true);

    try {
      const res = await login({
        pin: pinToSubmit,
        companyCode: pairedCompany.companyCode,
        organizationId: pairedCompany.id,
        storeId: pairedCompany.storeId
      });

      if (!res.ok) {
        setPin(''); // Clear PIN input on failed authentication
        setErrorMessage(res.error || 'Invalid PIN. Please try again.');
        playBeep(350, 'sawtooth', 0.2);
      } else {
        playBeep(1200, 'sine', 0.1);
      }
    } catch (err) {
      setPin('');
      setErrorMessage(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  }, [login, pairedCompany, playBeep]);

  // Touch keypad action
  const handleKeypadPress = (digit) => {
    if (loading) return;
    setErrorMessage('');
    if (pin.length < 4) {
      const updated = pin + digit;
      setPin(updated);
      if (updated.length === 4) {
        executePinLogin(updated);
      }
    }
  };

  const handleKeypadBackspace = () => {
    if (loading) return;
    setErrorMessage('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (loading) return;
    setErrorMessage('');
    setPin('');
  };

  // Physical keyboard listener for PIN mode
  useEffect(() => {
    if (authView !== 'LOGIN' || loginMode !== 'PIN') return;

    const handleKeyDown = (e) => {
      // Avoid intercepting if focus is on an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleKeypadClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authView, loginMode, pin, loading, handleKeypadPress]);

  // Handle Credentials Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const payload = loginMode === 'PIN'
        ? { pin, companyCode: pairedCompany?.companyCode, organizationId: pairedCompany?.id }
        : { identifier, password };
      
      const res = await login(payload);
      if (!res.ok) {
        if (loginMode === 'PIN') setPin('');
        setErrorMessage(res.error || 'Authentication failed');
        playBeep(400, 'sawtooth', 0.15);
      } else {
        if (!pairedCompany) {
          const stored = typeof window !== 'undefined' ? localStorage.getItem('loops_paired_company') : null;
          if (stored) setPairedCompany(JSON.parse(stored));
        }
        playBeep(1200, 'sine', 0.1);
      }
    } catch (err) {
      if (loginMode === 'PIN') setPin('');
      setErrorMessage(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Business Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (regForm.password !== regForm.confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (regForm.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const res = await registerBusiness(regForm);
      if (!res.ok) {
        setErrorMessage(res.error || 'Registration failed');
        playBeep(400, 'sawtooth', 0.15);
      } else {
        setSuccessMessage('Business organization initialized successfully!');
        playBeep(1200, 'sine', 0.15);
        fetchOrganizations();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message);
        if (data.resetToken) {
          setResetToken(data.resetToken);
          setAuthView('RESET_PASSWORD');
        }
      } else {
        setErrorMessage(data.error || 'Failed to dispatch password reset');
      }
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset Password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Password reset successfully! You can now log in.');
        setTimeout(() => {
          setAuthView('LOGIN');
          setSuccessMessage('');
        }, 1800);
      } else {
        setErrorMessage(data.error || 'Failed to reset password');
      }
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-obsidian-950 flex flex-col justify-center items-center p-4 sm:p-6 select-none relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brass-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brass-500 via-brass-400 to-brass-600 flex items-center justify-center font-display font-black text-obsidian-950 text-xl shadow-lg shadow-brass-500/20 mx-auto">
            ∞
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-wider uppercase font-display">
              The Loops Retail OS
            </h1>
            <p className="text-xs text-brass-400/90 font-mono tracking-widest uppercase">
              Private Enterprise Access Portal
            </p>
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN VIEW */}
        {authView === 'LOGIN' && (
          <div className="space-y-4">
            {/* Mode Switch: Credentials vs Cashier PIN */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-obsidian-950 border border-obsidian-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('CREDENTIALS');
                  setErrorMessage('');
                }}
                className={`py-1.5 rounded-lg font-semibold transition ${
                  loginMode === 'CREDENTIALS'
                    ? 'bg-brass-500 text-obsidian-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Owner / Staff Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('PIN');
                  setErrorMessage('');
                  setPin('');
                }}
                className={`py-1.5 rounded-lg font-semibold transition ${
                  loginMode === 'PIN'
                    ? 'bg-brass-500 text-obsidian-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Quick Cashier PIN
              </button>
            </div>

            {/* CREDENTIALS LOGIN FORM */}
            {loginMode === 'CREDENTIALS' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Email or Username</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. owner@theloops.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-xl pl-9 pr-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brass-500 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-medium">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthView('FORGOT_PASSWORD');
                        setErrorMessage('');
                      }}
                      className="text-[11px] text-brass-400 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-xl pl-9 pr-10 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brass-500 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-brass-400 transition"
                      tabIndex={-1}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md shadow-brass-500/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In to Ecosystem'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* QUICK PIN LOGIN FORM (COMPANY-CODE PAIRED AUTHENTICATION) */}
            {loginMode === 'PIN' && (
              <div className="space-y-4">
                {!pairedCompany ? (
                  /* STATE A: UNPAIRED TERMINAL - Require Private Company Code */
                  <div className="p-5 rounded-2xl bg-obsidian-950 border border-brass-500/30 text-center space-y-3.5 shadow-lg">
                    <div className="w-12 h-12 rounded-xl bg-brass-500/10 border border-brass-500/30 flex items-center justify-center text-brass-400 mx-auto">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Connect Terminal to Business or Store</h3>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                        Enter your confidential <span className="text-brass-400 font-mono font-bold">Company Code</span> (e.g. <span className="text-slate-200 font-mono">BV-8821</span>) or <span className="text-brass-400 font-mono font-bold">Store Branch Code</span> (e.g. <span className="text-slate-200 font-mono">MAIN</span>, <span className="text-slate-200 font-mono">SSW</span>) to pair this register.
                      </p>
                    </div>

                    <form onSubmit={handleVerifyCompanyCode} className="space-y-3 pt-1">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="e.g. BV-8821 or MAIN, SSW"
                          value={companyCodeInput}
                          onChange={(e) => setCompanyCodeInput(e.target.value.toUpperCase())}
                          className="w-full bg-obsidian-900 border border-brass-500/40 rounded-xl px-4 py-2.5 text-center text-slate-100 font-mono font-bold text-base tracking-widest uppercase placeholder-slate-600 focus:outline-none focus:border-brass-400 focus:ring-1 focus:ring-brass-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={verifyingCode || !companyCodeInput.trim()}
                        className="w-full py-2.5 rounded-xl font-bold text-xs bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md shadow-brass-500/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        <Link2 className="w-4 h-4" />
                        <span>{verifyingCode ? 'Verifying Code...' : 'Connect POS Register'}</span>
                      </button>
                    </form>

                    <div className="text-[10px] text-slate-500 font-mono pt-1">
                      Available in Backoffice → User & Access Management → Terminal Key
                    </div>
                  </div>
                ) : (
                  /* STATE B: PAIRED TERMINAL - Secure Company Context & PIN Keypad */
                  <>
                    {/* Active Paired Company Badge */}
                    <div className="p-3 rounded-xl bg-obsidian-950 border border-brass-500/30 flex items-center justify-between shadow-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brass-500/10 border border-brass-500/30 flex items-center justify-center text-brass-400 font-bold font-mono text-xs">
                          <Building2 className="w-4 h-4 text-brass-400" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 flex-wrap">
                            <span>{pairedCompany.name}</span>
                            {pairedCompany.storeName && (
                              <span className="text-xs text-brass-400 font-medium">• {pairedCompany.storeName}</span>
                            )}
                            <span className="text-[10px] bg-brass-500/20 text-brass-400 border border-brass-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                              {pairedCompany.storeCode || pairedCompany.companyCode}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {pairedCompany.storeName ? `Paired to ${pairedCompany.storeName}` : 'Terminal Paired & Active'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDisconnectCompany}
                        title="Unlink and pair a different company"
                        className="px-2.5 py-1 rounded-lg bg-obsidian-850 hover:bg-rose-500/15 border border-obsidian-750 hover:border-rose-500/30 text-[10px] text-slate-400 hover:text-rose-300 font-mono flex items-center space-x-1 transition"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Switch</span>
                      </button>
                    </div>

                    {/* Step 2: Masked PIN Indicator */}
                    <div className="text-center space-y-2">
                      <div className="text-xs text-slate-400 font-medium">
                        Enter Cashier PIN for <span className="text-slate-200 font-semibold">{pairedCompany.name}</span>
                      </div>

                      {/* 4 Masked Circle Dots */}
                      <div className="flex justify-center items-center space-x-4 py-2">
                        {[0, 1, 2, 3].map((idx) => {
                          const isFilled = pin.length > idx;
                          return (
                            <div
                              key={idx}
                              className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                                isFilled
                                  ? 'bg-brass-400 border-brass-400 scale-110 shadow-sm shadow-brass-400/50'
                                  : 'border-obsidian-700 bg-obsidian-950'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 3: Numeric Touch Keypad */}
                    <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto select-none">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          disabled={loading}
                          onClick={() => handleKeypadPress(digit)}
                          className="h-12 rounded-xl bg-obsidian-950 hover:bg-brass-500/15 border border-obsidian-800 hover:border-brass-500/40 text-slate-100 hover:text-brass-300 font-display font-bold text-lg transition active:scale-95 disabled:opacity-50 shadow-sm"
                        >
                          {digit}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={loading || pin.length === 0}
                        onClick={handleKeypadClear}
                        className="h-12 rounded-xl bg-obsidian-950 hover:bg-rose-500/15 border border-obsidian-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 font-mono text-xs font-bold transition active:scale-95 disabled:opacity-40"
                        title="Clear PIN"
                      >
                        CLR
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleKeypadPress('0')}
                        className="h-12 rounded-xl bg-obsidian-950 hover:bg-brass-500/15 border border-obsidian-800 hover:border-brass-500/40 text-slate-100 hover:text-brass-300 font-display font-bold text-lg transition active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        0
                      </button>

                      <button
                        type="button"
                        disabled={loading || pin.length === 0}
                        onClick={handleKeypadBackspace}
                        className="h-12 rounded-xl bg-obsidian-950 hover:bg-amber-500/15 border border-obsidian-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 font-mono text-xs font-bold transition active:scale-95 disabled:opacity-40 flex items-center justify-center"
                        title="Backspace"
                      >
                        ⌫
                      </button>
                    </div>

                    <div className="text-center text-[10px] text-slate-500 font-mono">
                      You can also use physical keyboard numbers (0-9) & Backspace
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Direct "Register Your Business" Option on Login Screen */}
            {orgStatus?.allowPublicRegistration !== false && (
              <button
                type="button"
                onClick={() => {
                  setAuthView('REGISTER_BUSINESS');
                  setErrorMessage('');
                }}
                className="w-full py-2 rounded-xl font-bold text-xs bg-obsidian-850 hover:bg-obsidian-800 border border-brass-500/40 hover:border-brass-500 text-brass-400 transition flex items-center justify-center space-x-2 shadow-xs group"
              >
                <Store className="w-3.5 h-3.5 text-brass-400 group-hover:scale-110 transition-transform" />
                <span>Register Your Business</span>
              </button>
            )}

            {/* Public Staff Notice */}
            <div className="pt-3 border-t border-obsidian-800 text-center space-y-2">
              <div className="p-2.5 rounded-lg bg-obsidian-950/80 border border-obsidian-800 text-[11px] text-slate-400 flex items-start space-x-2 text-left">
                <ShieldCheck className="w-4 h-4 text-brass-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Private Retail Ecosystem:</strong> Staff accounts and Quick PINs are isolated to each registered business company.
                </span>
              </div>

              {!orgStatus?.isRegistered && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('REGISTER_BUSINESS');
                    setErrorMessage('');
                  }}
                  className="text-xs text-brass-400 hover:underline font-medium inline-block"
                >
                  Are you the Business Owner? Initialize Business Organization
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. BUSINESS REGISTRATION VIEW (OWNER ONLY) */}
        {authView === 'REGISTER_BUSINESS' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
            <div className="pb-2 border-b border-obsidian-800 flex items-center justify-between">
              <span className="font-bold text-slate-200">Business Organization Setup</span>
              <button
                type="button"
                onClick={() => setAuthView('LOGIN')}
                className="text-[11px] text-brass-400 hover:underline"
              >
                Back to Login
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-400 block mb-0.5">Business Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Loops Flagship"
                  value={regForm.businessName}
                  onChange={(e) => setRegForm({ ...regForm, businessName: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-0.5">Owner Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={regForm.ownerName}
                  onChange={(e) => setRegForm({ ...regForm, ownerName: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-400 block mb-0.5">Owner Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="owner@theloops.com"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-0.5">Phone Number</label>
                <input
                  type="text"
                  placeholder="+855 23 888 999"
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-400 block mb-0.5">Master Password</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 6 characters"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 pr-8 text-slate-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-brass-400 transition"
                    tabIndex={-1}
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-0.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={regForm.confirmPassword}
                    onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 pr-8 text-slate-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-brass-400 transition"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-400 block mb-0.5">Country</label>
                <select
                  value={regForm.country || 'Cambodia'}
                  onChange={(e) => setRegForm({ ...regForm, country: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 text-slate-100 font-mono cursor-pointer"
                >
                  <option value="Cambodia">Cambodia</option>
                  <option value="Thailand">Thailand</option>
                  <option value="Vietnam">Vietnam</option>
                  <option value="Singapore">Singapore</option>
                  <option value="United States">United States</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-0.5">Primary Currency</label>
                <select
                  value={regForm.defaultCurrency}
                  onChange={(e) => setRegForm({ ...regForm, defaultCurrency: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 text-slate-100 font-mono cursor-pointer"
                >
                  <option value="USD">USD ($) Base Currency</option>
                  <option value="KHR">Cambodian Riel (៛)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-0.5">Business Logo URL (Optional)</label>
              <input
                type="text"
                placeholder="https://example.com/logo.png"
                value={regForm.logo || ''}
                onChange={(e) => setRegForm({ ...regForm, logo: e.target.value })}
                className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-lg p-2 text-slate-100 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md shadow-brass-500/20 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Initializing Business...' : 'Register Business & Create Owner Account'}
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD VIEW */}
        {authView === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
            <div className="pb-2 border-b border-obsidian-800 flex items-center justify-between">
              <span className="font-bold text-slate-200">Account Recovery</span>
              <button
                type="button"
                onClick={() => setAuthView('LOGIN')}
                className="text-[11px] text-brass-400 hover:underline"
              >
                Back to Login
              </button>
            </div>

            <p className="text-slate-400 text-xs">
              Enter your registered staff or owner email address to receive an account password reset link.
            </p>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">Registered Email Address</label>
              <input
                type="email"
                required
                placeholder="name@theloops.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-xl p-2.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-brass-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Request Password Reset Link'}
            </button>
          </form>
        )}

        {/* 4. RESET PASSWORD VIEW */}
        {authView === 'RESET_PASSWORD' && (
          <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
            <div className="pb-2 border-b border-obsidian-800 flex items-center justify-between">
              <span className="font-bold text-slate-200">Set New Account Password</span>
              <button
                type="button"
                onClick={() => setAuthView('LOGIN')}
                className="text-[11px] text-brass-400 hover:underline"
              >
                Back to Login
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">Reset Security Token</label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-xl p-2.5 text-slate-100 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">New Account Password</label>
              <div className="relative">
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-obsidian-950 border border-obsidian-700/80 rounded-xl p-2.5 pr-9 text-slate-100 font-mono text-xs focus:outline-none focus:border-brass-500"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-brass-400 transition"
                  tabIndex={-1}
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
