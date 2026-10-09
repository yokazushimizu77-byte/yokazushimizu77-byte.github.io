import React, { useState } from 'react';
import { Employee } from '../types';
import { Lock, Mail, Key, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { authenticateLocally } from '../utils/localStore';

interface LoginModalProps {
  employees: Employee[];
  onLoginSuccess: (emp: Employee) => void;
}

const toHalfWidth = (str: string): string => {
  if (!str) return '';
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
};

export const LoginModal: React.FC<LoginModalProps> = ({ employees, onLoginSuccess }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanInput = toHalfWidth(email.trim()).toLowerCase();

    if (!cleanInput) {
      setErrorMessage('メールアドレスを入力してください。');
      return;
    }
    if (!password) {
      setErrorMessage('パスワードを入力してください。');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try server endpoint first (for Node.js dev/production runtime)
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanInput, password }),
      });

      let data: any = null;
      try {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          data = await res.json();
        }
      } catch (jsonErr) {
        data = null;
      }

      if (res.ok && data?.success && data?.employee) {
        onLoginSuccess(data.employee);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      // Network error or static hosting (e.g. GitHub Pages) where /api doesn't exist
      console.warn('API endpoint unavailable, falling back to local authentication:', err);
    }

    // 2. Client-side authentication fallback (supports GitHub Pages static hosting & offline mode)
    const localResult = authenticateLocally(cleanInput, password);
    if (localResult.success && localResult.employee) {
      onLoginSuccess(localResult.employee);
    } else {
      setErrorMessage(localResult.error || 'メールアドレスまたはパスワードが正しくありません。');
    }
    setIsLoading(false);
  };

  const handleQuickFill = (emailValue: string, pass: string) => {
    setEmail(emailValue);
    setPassword(pass);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header Visual Banner */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white relative">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <ShieldCheck className="h-6 w-6 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">継続支援リライフ　シフト管理</h2>
              <p className="text-xs text-indigo-200 mt-0.5">本人認証ログイン (メールアドレス & パスワード)</p>
            </div>
          </div>
          <div className="mt-4 text-[11px] bg-white/10 border border-white/15 rounded-xl p-2.5 leading-relaxed text-indigo-100">
            ※一般利用者はご自身のシフト・昼食予約のみ閲覧・変更可能です。他者のデータ閲覧はアクセス権限により保護されています。
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center space-x-2 animate-shake">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              メールアドレス (Email) <span className="text-[10px] font-normal text-slate-500">（半角英数・全角英数ともに可）</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none z-20" />
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="例: sato@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail((prev) => toHalfWidth(prev))}
                className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-text relative z-10"
                autoComplete="email"
                required
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">※登録済みのメールアドレスを入力してください。（全角英数は自動変換されます）</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              パスワード (Password)
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none z-20" />
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-text relative z-10"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isLoading ? '認証中...' : 'ログイン'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Quick Demo Test Buttons */}
          <div className="pt-3 border-t border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 mb-2 flex items-center space-x-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>ワンクリック簡単入力（アカウント選択）</span>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickFill('yokazu.shimizu77@gmail.com', 'Relife0501')}
                className="w-full p-2.5 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 rounded-xl text-left transition-colors group cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-[10px] font-bold text-indigo-700">
                    福祉部・管理者アカウント
                  </div>
                  <div className="text-xs font-bold text-slate-800">清水 繁樹</div>
                  <div className="text-[10px] text-indigo-900/60">yokazu.shimizu77@gmail.com / PASS: Relife0501</div>
                </div>
                <span className="text-[10px] font-semibold text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-xs">
                  選択
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('sato@example.com', '1234')}
                  className="p-2 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl text-left transition-colors group cursor-pointer"
                >
                  <div className="text-[10px] font-bold text-emerald-700 group-hover:text-emerald-800">
                    一般社員アカウント
                  </div>
                  <div className="text-[11px] font-bold text-slate-800">佐藤 花子</div>
                  <div className="text-[9px] text-slate-400 truncate">sato@example.com / 1234</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('yamada@example.com', '1234')}
                  className="p-2 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-xl text-left transition-colors group cursor-pointer"
                >
                  <div className="text-[10px] font-bold text-indigo-700 group-hover:text-indigo-800">
                    開発部・管理者
                  </div>
                  <div className="text-[11px] font-bold text-slate-800">山田 太郎</div>
                  <div className="text-[9px] text-slate-400 truncate">yamada@example.com / 1234</div>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
