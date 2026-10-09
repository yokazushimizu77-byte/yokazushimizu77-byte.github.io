import React, { useState } from 'react';
import { Download, FileSpreadsheet, Users, FileText, Calendar, Utensils, X } from 'lucide-react';
import { Employee, LunchMenu, Reservation, ChangeLog } from '../types';
import { generateAndDownloadCSV, getLocalStore } from '../utils/localStore';

interface CSVExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string;
  employees?: Employee[];
  reservations?: Reservation[];
  lunchMenus?: LunchMenu[];
  changeLogs?: ChangeLog[];
}

export const CSVExportModal: React.FC<CSVExportModalProps> = ({
  isOpen,
  onClose,
  currentMonth,
  employees,
  reservations,
  lunchMenus,
  changeLogs,
}) => {
  const [exportMonth, setExportMonth] = useState<string>(currentMonth);
  const [exportType, setExportType] = useState<'employees' | 'matrix' | 'lunch_orders' | 'logs' | 'template_employees'>('employees');

  if (!isOpen) return null;

  const handleDownload = () => {
    const store = getLocalStore();
    const emps = employees && employees.length > 0 ? employees : store.employees;
    const res = reservations && reservations.length > 0 ? reservations : store.reservations;
    const menus = lunchMenus && lunchMenus.length > 0 ? lunchMenus : store.lunchMenus;
    const logs = changeLogs && changeLogs.length > 0 ? changeLogs : store.changeLogs;

    generateAndDownloadCSV(exportType, exportMonth, emps, res, menus, logs);
    onClose();
  };

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
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">CSVデータ ダウンロード</h3>
            <p className="text-xs text-slate-500">Excel対応 UTF-8 BOM形式で文字化けなくダウンロード</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {['matrix', 'lunch_orders'].includes(exportType) && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">対象月の選択</label>
              <input
                type="month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 font-bold"
              />
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-2">ダウンロード種別の選択</label>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <label
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-colors ${
                  exportType === 'employees'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'employees'}
                  onChange={() => setExportType('employees')}
                  className="mt-0.5 mr-2.5 text-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    <span>登録職員（社員マスター）一覧 CSV</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">推奨</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    全職員の社員ID、氏名、部署、権限区分、メールアドレス、パスワードの登録データ
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-colors ${
                  exportType === 'matrix'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'matrix'}
                  onChange={() => setExportType('matrix')}
                  className="mt-0.5 mr-2.5 text-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span>出勤・昼食マトリクス一覧 CSV</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    縦：社員 / 横：日付の月間出勤区分および昼食コードマトリクス表
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-colors ${
                  exportType === 'lunch_orders'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'lunch_orders'}
                  onChange={() => setExportType('lunch_orders')}
                  className="mt-0.5 mr-2.5 text-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <Utensils className="h-3.5 w-3.5 text-amber-600" />
                    <span>日別 昼食メニュー発注集計 CSV</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    給食業者発注用の明細リスト（日付、社員名、部署、発注メニュー名）
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-colors ${
                  exportType === 'logs'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'logs'}
                  onChange={() => setExportType('logs')}
                  className="mt-0.5 mr-2.5 text-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <FileText className="h-3.5 w-3.5 text-slate-600" />
                    <span>変更・キャンセル監査履歴ログ CSV</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    全件の操作ログ、変更前後の値、理由、操作者情報
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start p-3 rounded-xl border cursor-pointer transition-colors ${
                  exportType === 'template_employees'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="exportType"
                  checked={exportType === 'template_employees'}
                  onChange={() => setExportType('template_employees')}
                  className="mt-0.5 mr-2.5 text-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    <span>職員一括登録用 雛形サンプル CSV</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Excelやスプレッドシートで編集して一括登録するためのテンプレートファイル
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            閉じる
          </button>
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>CSVをダウンロード</span>
          </button>
        </div>
      </div>
    </div>
  );
};
