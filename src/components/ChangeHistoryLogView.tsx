import React, { useState } from 'react';
import { ChangeLog, LunchMenu, Employee } from '../types';
import { History, ArrowRight, User, Calendar, Tag, Search, Filter, ShieldAlert } from 'lucide-react';

interface ChangeHistoryLogViewProps {
  changeLogs: ChangeLog[];
  lunchMenus: LunchMenu[];
  currentEmployee: Employee;
}

export const ChangeHistoryLogView: React.FC<ChangeHistoryLogViewProps> = ({
  changeLogs,
  lunchMenus,
  currentEmployee,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const getMenuName = (id?: string | null) => {
    if (!id) return 'なし';
    const menu = lunchMenus.find((m) => m.id === id);
    return menu ? `[${menu.code}] ${menu.name}` : '未選択';
  };

  const filteredLogs = changeLogs.filter((log) => {
    // Non-admins can only see logs concerning themselves
    if (currentEmployee.role !== 'admin') {
      const isRelevantToUser = log.employeeId === currentEmployee.id || log.modifiedBy === currentEmployee.id;
      if (!isRelevantToUser) return false;
    }

    const matchesSearch =
      log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.modifiedByName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.date.includes(searchTerm) ||
      (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-900">予約変更・キャンセル 履歴ログ</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              管理者および社員による全ての予約変更、理由、変更前後のパラメータを全件追跡・監査できます。
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              総ログ数: {filteredLogs.length}件
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="社員名、変更者、日付、変更理由で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
            >
              <option value="ALL">すべての操作種別</option>
              <option value="update">内容変更 (update)</option>
              <option value="create">新規登録 (create)</option>
              <option value="confirm">予約確定 (confirm)</option>
              <option value="lock">月間ロック (lock)</option>
              <option value="delete">利用者削除 (delete)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Timeline List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
            <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">該当する変更履歴ログはありません</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      log.action === 'update'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : log.action === 'confirm'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : log.action === 'lock'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : log.action === 'delete'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {log.action === 'update'
                      ? '予約変更'
                      : log.action === 'confirm'
                      ? '予約確定'
                      : log.action === 'lock'
                      ? '月間ロック'
                      : log.action === 'delete'
                      ? '利用者削除'
                      : '新規作成'}
                  </span>

                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    対象社員: <strong className="text-indigo-900">{log.employeeName}</strong>
                  </span>

                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    対象日: <strong className="text-slate-800">{log.date}</strong>
                  </span>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  操作日時: {new Date(log.timestamp).toLocaleString('ja-JP')} | 操作者: {log.modifiedByName}
                </div>
              </div>

              {/* Before vs After Diff Preview */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Before State */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">【変更前】</span>
                  {log.beforeState ? (
                    <div className="mt-1 space-y-0.5 text-slate-700">
                      <div>出勤: <strong>{log.beforeState.attendance || '未登録'}</strong></div>
                      <div>昼食: <strong>{log.beforeState.lunchStatus || 'なし'}</strong></div>
                      {log.beforeState.lunchMenuId && (
                        <div className="text-[11px] text-slate-500 truncate">
                          メニュー: {getMenuName(log.beforeState.lunchMenuId)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-400 italic">データなし (新規)</div>
                  )}
                </div>

                {/* After State */}
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">【変更後】</span>
                  {log.afterState ? (
                    <div className="mt-1 space-y-0.5 text-indigo-950">
                      <div>出勤: <strong>{log.afterState.attendance || '未登録'}</strong></div>
                      <div>昼食: <strong>{log.afterState.lunchStatus || 'なし'}</strong></div>
                      {log.afterState.lunchMenuId && (
                        <div className="text-[11px] text-indigo-700 font-medium truncate">
                          メニュー: {getMenuName(log.afterState.lunchMenuId)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-rose-600 font-bold">予約キャンセル / 削除</div>
                  )}
                </div>
              </div>

              {/* Reason */}
              {log.reason && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="font-bold text-slate-500">変更理由:</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-medium">{log.reason}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
