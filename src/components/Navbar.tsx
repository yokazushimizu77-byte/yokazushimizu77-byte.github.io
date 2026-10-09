import React from 'react';
import { Employee } from '../types';
import { Calendar, Users, Bell, LogOut } from 'lucide-react';

interface NavbarProps {
  currentEmployee: Employee;
  employees: Employee[];
  activeTab: 'calendar' | 'admin' | 'logs' | 'security';
  onTabChange: (tab: 'calendar' | 'admin' | 'logs' | 'security') => void;
  onOpenNotificationModal: () => void;
  onOpenCSVModal: () => void;
  isRealtimeConnected: boolean;
  onRefreshData: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentEmployee,
  employees,
  activeTab,
  onTabChange,
  onOpenNotificationModal,
  onOpenCSVModal,
  isRealtimeConnected,
  onRefreshData,
  onLogout,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs flex items-center justify-between px-4 sm:px-8 shrink-0">
      <div className="flex items-center gap-6 lg:gap-8">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-indigo-700 flex items-center gap-2 leading-tight">
              継続支援リライフ　シフト管理
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              当月・次月出勤管理 ＆ 昼食注文システム
            </p>
          </div>
        </div>

        {/* Mode Indicator & Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {/* User Screen Button */}
          <button
            onClick={() => onTabChange('calendar')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors rounded-lg flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'font-bold text-indigo-600 bg-indigo-50/80 border-b-2 border-indigo-600'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>利用者画面 (自分の予約)</span>
          </button>

          {/* Admin Screen Button (Visible for Admins, or restricted badge for non-admins) */}
          {currentEmployee.role === 'admin' ? (
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors rounded-lg flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'font-bold text-indigo-600 bg-indigo-50/80 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>管理者画面 (全体一覧 & 初期登録)</span>
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[9px] font-bold rounded border border-indigo-200">
                管理者専用
              </span>
            </button>
          ) : (
            <div
              className="px-3.5 py-2 text-xs text-slate-400 font-medium flex items-center gap-1.5 opacity-60 cursor-not-allowed select-none"
              title="管理者画面は管理者権限アカウントのみアクセス可能です"
            >
              <Users className="h-3.5 w-3.5" />
              <span>管理者画面 (ロック中)</span>
            </div>
          )}

          <button
            onClick={() => onTabChange('logs')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors rounded-lg ${
              activeTab === 'logs'
                ? 'font-bold text-indigo-600 bg-indigo-50/80 border-b-2 border-indigo-600'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            変更・キャンセル履歴
          </button>
        </nav>
      </div>

      {/* Right Controls: User Profile & Quick Tools */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Quick Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenNotificationModal}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="通知リマインド設定"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>

        {/* User Profile Badge & Logout Button */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-200">
            <div className="flex items-center space-x-2.5">
              <div className={`w-7 h-7 rounded-full border-2 border-white shadow-xs flex items-center justify-center text-white text-xs font-bold ${currentEmployee.avatarColor || 'bg-indigo-600'}`}>
                {currentEmployee.name.substring(0, 2)}
              </div>
              <div className="flex flex-col text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1">
                  <span>{currentEmployee.name}</span>
                  {currentEmployee.role === 'admin' && (
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1 rounded">
                      管理者
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-medium text-slate-400">
                  ID: {currentEmployee.id} • {currentEmployee.department}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="システムからログアウト"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">ログアウト</span>
          </button>
        </div>
      </div>
    </header>
  );
};
