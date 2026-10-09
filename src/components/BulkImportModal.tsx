import React, { useState, useId } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Users,
  Calendar,
  X,
  FileText,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Employee } from '../types';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployee: Employee;
  employees: Employee[];
  onRefreshData: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  employees,
  onRefreshData,
}) => {
  const fileInputId = useId();
  const [activeTab, setActiveTab] = useState<'employees' | 'reservations'>('employees');
  const [inputText, setInputText] = useState<string>('');
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    details?: string;
  } | null>(null);

  if (!isOpen) return null;

  // Helper to normalize full-width alphanumeric to half-width
  const toHalfWidth = (str: string) =>
    str.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');

  // Parse CSV or TSV (tab-separated) lines
  const parseRows = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    return lines.map((line) => {
      // Split by tab if tabs exist, otherwise comma
      if (line.includes('\t')) {
        return line.split('\t').map((c) => c.replace(/^["']|["']$/g, '').trim());
      }

      // Simple CSV split considering quotes
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    });
  };

  const parsedRawRows = parseRows(inputText);

  // Check if first line is header
  const isHeaderRow = (row: string[]) => {
    if (!row || row.length === 0) return false;
    const firstCell = row[0].toLowerCase();
    return (
      firstCell.includes('id') ||
      firstCell.includes('社員') ||
      firstCell.includes('日付') ||
      firstCell.includes('date') ||
      firstCell.includes('氏名') ||
      firstCell.includes('名前')
    );
  };

  const dataRows =
    parsedRawRows.length > 0 && isHeaderRow(parsedRawRows[0])
      ? parsedRawRows.slice(1)
      : parsedRawRows;

  // Parsed employee items
  const parsedEmployees = dataRows.map((cols, idx) => {
    const rawId = cols[0] || '';
    const name = cols[1] || '';
    const dept = cols[2] || '一般';
    const rawRole = cols[3] || '一般社員';
    const rawEmail = cols[4] || '';
    const rawPassword = cols[5] || '1234';

    const cleanId = toHalfWidth(rawId.trim()).toUpperCase();
    const isRoleAdmin =
      rawRole.toLowerCase() === 'admin' ||
      rawRole.includes('管理');
    const role: 'admin' | 'employee' = isRoleAdmin ? 'admin' : 'employee';
    const email = rawEmail.trim() || (cleanId ? `${cleanId.toLowerCase()}@example.com` : '');
    const password = rawPassword.trim() || '1234';

    const existing = employees.find((e) => toHalfWidth(e.id).toUpperCase() === cleanId);
    const isValid = cleanId.length > 0 && name.trim().length > 0;

    return {
      index: idx + 1,
      id: cleanId,
      name: name.trim(),
      department: dept.trim() || '一般',
      role,
      email,
      password,
      isExisting: !!existing,
      isValid,
    };
  });

  // Parsed reservation items
  const parsedReservations = dataRows.map((cols, idx) => {
    const rawDate = cols[0] || '';
    const rawEmpId = cols[1] || '';
    const rawAtt = cols[2] || 'フル';
    const rawLunch = cols[3] || 'あり';
    const rawMenu = cols[4] || '';

    const cleanDate = rawDate.trim();
    const cleanEmpId = toHalfWidth(rawEmpId.trim()).toUpperCase();
    const isValid = cleanDate.match(/^\d{4}-\d{2}-\d{2}$/) && cleanEmpId.length > 0;
    const empExists = employees.some((e) => toHalfWidth(e.id).toUpperCase() === cleanEmpId);

    return {
      index: idx + 1,
      date: cleanDate,
      employeeId: cleanEmpId,
      attendance: rawAtt.trim() || 'フル',
      lunchStatus: rawLunch.includes('あり') || rawLunch.toLowerCase() === 'yes' ? 'あり' : 'なし',
      lunchMenuCode: rawMenu.trim().toUpperCase(),
      isValid: !!isValid && empExists,
      empExists,
    };
  });

  // Handle File Upload (.csv / .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
        setResultMessage(null);
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Load sample data into text box
  const handleInsertSample = () => {
    if (activeTab === 'employees') {
      setInputText(
        `社員ID,氏名,部署,権限,メールアドレス,パスワード\n` +
        `EMP009,武田 信玄,営業部,一般社員,takeda@example.com,1234\n` +
        `EMP010,吉田 健一,開発部,管理者,yoshida@example.com,1234\n` +
        `EMP011,佐藤 智子,総務部,一般社員,satot@example.com,1234\n` +
        `EMP012,鈴木 大輔,企画部,一般社員,daisuke@example.com,1234`
      );
    } else {
      const todayStr = new Date().toISOString().substring(0, 10);
      setInputText(
        `日付,社員ID,出勤区分,昼食ありなし,メニューコード\n` +
        `${todayStr},EMP001,フル,あり,A\n` +
        `${todayStr},EMP002,午前,なし,\n` +
        `${todayStr},EMP003,フル,あり,B`
      );
    }
    setResultMessage(null);
  };

  // Submit bulk import
  const handleSubmit = async () => {
    setResultMessage(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'employees') {
        const validItems = parsedEmployees.filter((item) => item.isValid);
        if (validItems.length === 0) {
          setResultMessage({
            type: 'error',
            text: '有効な職員データが見つかりません。入力内容を確認してください。',
          });
          setIsSubmitting(false);
          return;
        }

        const res = await fetch('/api/employees/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeesData: validItems,
            overwriteExisting,
            modifiedById: currentEmployee.id,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '一括登録に失敗しました');
        }

        setResultMessage({
          type: 'success',
          text: `一括登録が完了しました！（新規追加: ${data.addedCount}件 / 更新: ${data.updatedCount}件 / スキップ: ${data.skippedCount}件）`,
        });
        onRefreshData();
      } else {
        const validItems = parsedReservations.filter((item) => item.isValid);
        if (validItems.length === 0) {
          setResultMessage({
            type: 'error',
            text: '有効なシフト・予約データが見つかりません。社員IDや日付形式（YYYY-MM-DD）を確認してください。',
          });
          setIsSubmitting(false);
          return;
        }

        const res = await fetch('/api/reservations/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationsData: validItems,
            modifiedById: currentEmployee.id,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'シフト一括登録に失敗しました');
        }

        setResultMessage({
          type: 'success',
          text: `出勤・シフトデータの一括登録が完了しました！（登録・更新: ${data.successCount}件 / スキップ: ${data.skippedCount}件）`,
        });
        onRefreshData();
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.message || '一括登録処理中にエラーが発生しました。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="h-11 w-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>一括データ登録 & CSVダウンロード</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                管理者専用
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              CSVファイルのアップロード、またはExcel・スプレッドシートからのコピペで複数データをまとめて登録・更新できます。
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-5">
          <button
            onClick={() => {
              setActiveTab('employees');
              setInputText('');
              setResultMessage(null);
            }}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'employees'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>1. 職員マスター一括登録（氏名・メール・PASS・権限）</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('reservations');
              setInputText('');
              setResultMessage(null);
            }}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'reservations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>2. 出勤・シフト一括登録（日付・出勤区分・昼食）</span>
          </button>
        </div>

        {/* Action Bar (Download Template & Download Current Data) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Info className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              {activeTab === 'employees'
                ? '列構成：社員ID / 氏名 / 部署 / 権限(管理者or一般社員) / メールアドレス / パスワード'
                : '列構成：日付(YYYY-MM-DD) / 社員ID / 出勤区分(フル/午前/午後/休み等) / 昼食(あり/なし) / 注文メニューコード'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInsertSample}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="入力枠にサンプルデータを読み込みます"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span>サンプルを挿入</span>
            </button>

            {activeTab === 'employees' ? (
              <>
                <a
                  href="/api/export/csv?type=template_employees"
                  download="template_employees_import.csv"
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Excelで編集できるCSV雛形ファイルをダウンロード"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>雛形CSVをDL</span>
                </a>

                <a
                  href="/api/export/csv?type=employees"
                  download="employees_master.csv"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="現在登録済みの全社員一覧をCSVダウンロード"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>現在の登録データをCSV保存</span>
                </a>
              </>
            ) : (
              <>
                <a
                  href="/api/export/csv?type=template_reservations"
                  download="template_reservations_import.csv"
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>雛形CSVをDL</span>
                </a>

                <a
                  href="/api/export/csv?type=matrix"
                  download="attendance_matrix.csv"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>現在のシフトをCSV保存</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* File Select & Text Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Left: File Drag/Select Dropzone */}
          <div className="md:col-span-1 border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/60 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors">
            <UploadCloud className="h-8 w-8 text-indigo-500 mb-2" />
            <span className="text-xs font-bold text-slate-800">CSVファイルを選択</span>
            <span className="text-[11px] text-slate-400 mt-0.5">.csv / .txt ファイル対応</span>
            <label
              htmlFor={fileInputId}
              className="mt-3 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            >
              ファイルを参照
            </label>
            <input
              id={fileInputId}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Right: Paste Textbox */}
          <div className="md:col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                または テキスト直接貼り付け（Excelからそのままコピペ可）
              </label>
              {inputText && (
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  クリア
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setResultMessage(null);
              }}
              placeholder={
                activeTab === 'employees'
                  ? '例:\nEMP009,武田 信玄,営業部,一般社員,takeda@example.com,1234\nEMP010,吉田 健一,開発部,管理者,yoshida@example.com,1234'
                  : '例:\n2026-10-09,EMP001,フル,あり,A\n2026-10-09,EMP002,午前,なし,'
              }
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Options */}
        {activeTab === 'employees' && (
          <div className="mb-4 flex items-center">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>既に登録済みの社員IDが存在する場合、名前・部署・メール・パスワードを上書き更新する</span>
            </label>
          </div>
        )}

        {/* Result Message Banner */}
        {resultMessage && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-bold flex items-center gap-2 ${
              resultMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {resultMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{resultMessage.text}</span>
          </div>
        )}

        {/* Preview Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <span>取り込みプレビュー</span>
              <span className="text-[11px] font-normal text-slate-500">
                （解析件数: {dataRows.length}件）
              </span>
            </div>
            {dataRows.length > 0 && (
              <div className="flex items-center gap-2 text-[10px]">
                {activeTab === 'employees' ? (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      新規: {parsedEmployees.filter((p) => p.isValid && !p.isExisting).length}件
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                      既存更新: {parsedEmployees.filter((p) => p.isValid && p.isExisting).length}件
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                      エラー: {parsedEmployees.filter((p) => !p.isValid).length}件
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      有効: {parsedReservations.filter((p) => p.isValid).length}件
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                      無効: {parsedReservations.filter((p) => !p.isValid).length}件
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto">
            {dataRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                CSVファイルを選択するか、上の枠にテキストを入力するとプレビューが表示されます。
              </div>
            ) : activeTab === 'employees' ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-[11px] sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-12 text-center">#</th>
                    <th className="p-2">状態</th>
                    <th className="p-2">社員ID</th>
                    <th className="p-2">氏名</th>
                    <th className="p-2">部署</th>
                    <th className="p-2">権限</th>
                    <th className="p-2">メールアドレス</th>
                    <th className="p-2">パスワード</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedEmployees.map((emp) => (
                    <tr
                      key={emp.index}
                      className={
                        !emp.isValid
                          ? 'bg-rose-50/50'
                          : emp.isExisting
                          ? 'bg-blue-50/30'
                          : 'hover:bg-slate-50'
                      }
                    >
                      <td className="p-2 text-center text-slate-400 text-[10px]">{emp.index}</td>
                      <td className="p-2">
                        {!emp.isValid ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                            ID/氏名空欄
                          </span>
                        ) : emp.isExisting ? (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                            {overwriteExisting ? '既存上書き' : 'スキップ'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            新規登録
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono font-bold text-slate-800">{emp.id || '-'}</td>
                      <td className="p-2 font-bold text-slate-900">{emp.name || '-'}</td>
                      <td className="p-2 text-slate-600">{emp.department}</td>
                      <td className="p-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            emp.role === 'admin'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {emp.role === 'admin' ? '管理者' : '一般社員'}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600 font-mono text-[11px]">{emp.email}</td>
                      <td className="p-2 text-slate-500 font-mono text-[11px]">{emp.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-[11px] sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-12 text-center">#</th>
                    <th className="p-2">状態</th>
                    <th className="p-2">日付</th>
                    <th className="p-2">社員ID</th>
                    <th className="p-2">出勤区分</th>
                    <th className="p-2">昼食</th>
                    <th className="p-2">メニューコード</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedReservations.map((res) => (
                    <tr
                      key={res.index}
                      className={!res.isValid ? 'bg-rose-50/50' : 'hover:bg-slate-50'}
                    >
                      <td className="p-2 text-center text-slate-400 text-[10px]">{res.index}</td>
                      <td className="p-2">
                        {!res.isValid ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                            {!res.empExists ? '社員ID未登録' : '日付形式不正'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            取込可能
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-slate-800">{res.date}</td>
                      <td className="p-2 font-mono font-bold text-slate-800">{res.employeeId}</td>
                      <td className="p-2 font-bold text-indigo-700">{res.attendance}</td>
                      <td className="p-2 text-slate-700">{res.lunchStatus}</td>
                      <td className="p-2 font-mono">{res.lunchMenuCode || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            {activeTab === 'employees' && (
              <span>※新規登録された職員には、当月および次月の平日デフォルト出勤枠が自動生成されます。</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              閉じる
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || dataRows.length === 0}
              className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                isSubmitting || dataRows.length === 0
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>登録処理中...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>一括登録を実行（{dataRows.length}件）</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
