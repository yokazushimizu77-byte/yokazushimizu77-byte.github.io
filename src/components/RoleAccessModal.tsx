import React from 'react';
import { ShieldCheck, UserCheck, Lock, CheckCircle2, XCircle, X } from 'lucide-react';

interface RoleAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleAccessModal: React.FC<RoleAccessModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">セキュリティ ＆ アクセス権限管理</h3>
            <p className="text-xs text-slate-500">社員ごとのアクセス制限と操作ロール設定</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Employee Role */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-indigo-600" />
                一般社員 ロール (Employee)
              </span>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold rounded text-[10px]">
                標準権限
              </span>
            </div>

            <ul className="space-y-1.5 text-slate-600 font-medium pl-1">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                本人の当月・次月出勤区分（午前・午後・フル・休み）および昼食メニュー予約・編集
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                チームメンバー全体の各日の予約集計数（午前数・午後数・昼食数）のリアルタイム閲覧
              </li>
              <li className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                他社員の予約内容の直接編集・キャンセル（禁止）
              </li>
              <li className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                確定・ロック済み予約の直接変更（不可 / 理由付き修正依頼が必要）
              </li>
            </ul>
          </div>

          {/* Admin Role */}
          <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-500" />
                管理者 ロール (Admin)
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded text-[10px]">
                全権限 (管理者)
              </span>
            </div>

            <ul className="space-y-1.5 text-indigo-900 font-medium pl-1">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                全社員の一括マトリクス閲覧・全体状況管理
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                理由の記録を伴う全社員予約の代理変更・キャンセル操作
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                月間一括確定・ロックおよびロック解除制御
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                CSVデータの全種別出力（出勤マトリクス、昼食発注名細、監査ログ）
              </li>
            </ul>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
            💡 ナビゲーションバー右上のユーザー切替メニューから、一般社員（佐藤など）と管理者（山田など）を自由に切り替えて権限制御を試すことができます。
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
