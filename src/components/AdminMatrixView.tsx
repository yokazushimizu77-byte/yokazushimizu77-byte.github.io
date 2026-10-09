import React, { useState, useMemo } from 'react';
import { Employee, Reservation, LunchMenu, AttendanceStatus, LunchStatus } from '../types';

const toHalfWidth = (str: string): string => {
  if (!str) return '';
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
};
import {
  Users,
  Search,
  Filter,
  Lock,
  Unlock,
  Edit3,
  CheckCircle,
  XCircle,
  Download,
  AlertTriangle,
  ArrowRight,
  Shield,
  Utensils,
  Calendar,
  UserPlus,
  PlusCircle,
  X,
  ShieldAlert,
  Trash2,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';
import { BulkImportModal } from './BulkImportModal';

interface AdminMatrixViewProps {
  currentEmployee: Employee;
  employees: Employee[];
  reservations: Reservation[];
  lunchMenus: LunchMenu[];
  onUpdateReservations: (
    employeeId: string,
    updates: (Partial<Reservation> & { date: string })[],
    reason?: string
  ) => Promise<void>;
  onConfirmMonth: (employeeId: string, month: string, status?: 'confirmed' | 'locked') => Promise<void>;
  onOpenCSVModal: () => void;
  onRegisterEmployee?: (newEmp: { id: string; name: string; department: string; role: 'admin' | 'employee' }) => Promise<boolean>;
  onUpdateEmployee?: (updateData: {
    targetEmployeeId: string;
    newId: string;
    name: string;
    department: string;
    role: 'admin' | 'employee';
    password?: string;
    email?: string;
  }) => Promise<boolean>;
  onDeleteEmployee?: (employeeId: string) => Promise<boolean>;
  onSaveLunchMenu?: (menuData: {
    id?: string;
    code: string;
    name: string;
    category: string;
    description?: string;
    price: number;
  }) => Promise<boolean>;
  onDeleteLunchMenu?: (id: string) => Promise<boolean>;
  onRefreshData?: () => void;
}

export const AdminMatrixView: React.FC<AdminMatrixViewProps> = ({
  currentEmployee,
  employees,
  reservations,
  lunchMenus,
  onUpdateReservations,
  onConfirmMonth,
  onOpenCSVModal,
  onRegisterEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onSaveLunchMenu,
  onDeleteLunchMenu,
  onRefreshData,
}) => {
  // Target month selection
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthObj = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthObj.getFullYear()}-${String(nextMonthObj.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Bulk Import Modal State (Admin Only)
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState<boolean>(false);

  // Employee Registration & Info Update Modal State (Admin Only)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editId, setEditId] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editDepartment, setEditDepartment] = useState<string>('開発部');
  const [editCustomDept, setEditCustomDept] = useState<string>('');
  const [editRole, setEditRole] = useState<'admin' | 'employee'>('employee');
  const [editPassword, setEditPassword] = useState<string>('1234');
  const [editEmail, setEditEmail] = useState<string>('');
  const [isUpdatingEmployee, setIsUpdatingEmployee] = useState<boolean>(false);

  const handleOpenEditEmployeeModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditId(emp.id);
    setEditName(emp.name);
    if (['開発部', '製造部', '営業部', '総務部', 'サポート部'].includes(emp.department)) {
      setEditDepartment(emp.department);
      setEditCustomDept('');
    } else {
      setEditDepartment('OTHER');
      setEditCustomDept(emp.department);
    }
    setEditRole(emp.role);
    setEditPassword(emp.password || '1234');
    setEditEmail(emp.email || '');
  };

  const handleUpdateEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !onUpdateEmployee) return;

    const cleanEditId = toHalfWidth(editId.trim());
    if (!cleanEditId) {
      alert('社員IDを入力してください。');
      return;
    }

    const finalDept = editDepartment === 'OTHER' ? editCustomDept.trim() : editDepartment;
    if (!finalDept) {
      alert('部署名を入力してください。');
      return;
    }

    setIsUpdatingEmployee(true);
    const success = await onUpdateEmployee({
      targetEmployeeId: editingEmployee.id,
      newId: cleanEditId,
      name: editName.trim(),
      department: finalDept,
      role: editRole,
      password: editPassword,
      email: editEmail,
    });
    setIsUpdatingEmployee(false);

    if (success) {
      setEditingEmployee(null);
    }
  };

  // Initial Registration Modal State (Admin Only)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [regId, setRegId] = useState<string>('');
  const [regName, setRegName] = useState<string>('');
  const [regDepartment, setRegDepartment] = useState<string>('開発部');
  const [regCustomDept, setRegCustomDept] = useState<string>('');
  const [regRole, setRegRole] = useState<'admin' | 'employee'>('employee');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Employee Deletion Confirmation Modal State
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Lunch Menu Management Modal State (Admin Only)
  const [isMenuModalOpen, setIsMenuModalOpen] = useState<boolean>(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuCode, setMenuCode] = useState<string>('');
  const [menuName, setMenuName] = useState<string>('');
  const [menuCategory, setMenuCategory] = useState<string>('土曜限定');
  const [menuCustomCategory, setMenuCustomCategory] = useState<string>('');
  const [menuPrice, setMenuPrice] = useState<number>(650);
  const [menuDescription, setMenuDescription] = useState<string>('');
  const [isSavingMenu, setIsSavingMenu] = useState<boolean>(false);

  // Custom Inline Delete Confirmation state for Menu
  const [deletingMenuTarget, setDeletingMenuTarget] = useState<LunchMenu | null>(null);
  const [isDeletingMenu, setIsDeletingMenu] = useState<boolean>(false);
  const [menuFormError, setMenuFormError] = useState<string | null>(null);

  const resetMenuForm = () => {
    setEditingMenuId(null);
    setMenuCode('');
    setMenuName('');
    setMenuCategory('土曜限定');
    setMenuCustomCategory('');
    setMenuPrice(650);
    setMenuDescription('');
    setMenuFormError(null);
  };

  const handleOpenEditMenu = (m: LunchMenu) => {
    setEditingMenuId(m.id);
    setMenuCode(m.code);
    setMenuName(m.name);
    setMenuFormError(null);
    if (['肉料理', '魚料理', 'ヘルシー', 'カレー', '麺類', '土曜限定'].includes(m.category)) {
      setMenuCategory(m.category);
      setMenuCustomCategory('');
    } else {
      setMenuCategory('OTHER');
      setMenuCustomCategory(m.category);
    }
    setMenuPrice(m.price);
    setMenuDescription(m.description);
  };

  const handleSaveMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveLunchMenu) return;

    setMenuFormError(null);
    const cleanCode = toHalfWidth(menuCode.trim()).toUpperCase();
    if (!cleanCode || !menuName.trim()) {
      setMenuFormError('メニューコードとメニュー名を入力してください。');
      return;
    }

    const finalCategory = menuCategory === 'OTHER' ? menuCustomCategory.trim() : menuCategory;
    if (!finalCategory) {
      setMenuFormError('カテゴリ名を入力してください。');
      return;
    }

    setIsSavingMenu(true);
    const success = await onSaveLunchMenu({
      id: editingMenuId || undefined,
      code: cleanCode,
      name: menuName.trim(),
      category: finalCategory,
      description: menuDescription.trim(),
      price: menuPrice,
    });
    setIsSavingMenu(false);

    if (success) {
      resetMenuForm();
    }
  };

  const handleConfirmDeleteMenu = async () => {
    if (!deletingMenuTarget || !onDeleteLunchMenu) return;
    setIsDeletingMenu(true);
    const ok = await onDeleteLunchMenu(deletingMenuTarget.id);
    setIsDeletingMenu(false);
    if (ok) {
      if (editingMenuId === deletingMenuTarget.id) {
        resetMenuForm();
      }
      setDeletingMenuTarget(null);
    }
  };

  // Edit Modal State
  const [editingCell, setEditingCell] = useState<{
    employee: Employee;
    dateStr: string;
    existingRes?: Reservation;
  } | null>(null);

  const [newAttendance, setNewAttendance] = useState<AttendanceStatus>('フル');
  const [newLunchStatus, setNewLunchStatus] = useState<LunchStatus>('あり');
  const [newLunchMenuId, setNewLunchMenuId] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Compute days in selected month
  const [yearStr, monthNumStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);

  const daysInMonth = useMemo(() => {
    const totalDays = new Date(year, month, 0).getDate();
    const days: { dateStr: string; dayNum: number; dayOfWeekStr: string; isWeekend: boolean }[] = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        dayOfWeekStr: dayNames[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }
    return days;
  }, [year, month]);

  // Unique departments for filter
  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department)));
  }, [employees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = deptFilter === 'ALL' || emp.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, deptFilter]);

  // Open edit modal
  const handleOpenEditCell = (emp: Employee, dateStr: string) => {
    const existingRes = reservations.find((r) => r.employeeId === emp.id && r.date === dateStr);
    setEditingCell({ employee: emp, dateStr, existingRes });

    setNewAttendance(existingRes?.attendance || 'フル');
    setNewLunchStatus(existingRes?.lunchStatus || 'あり');
    setNewLunchMenuId(existingRes?.lunchMenuId || lunchMenus[0]?.id || '');
    setChangeReason('');
  };

  // Submit edit with Before/After Diff logging
  const handleSaveCellEdit = async () => {
    if (!editingCell) return;

    const finalReason = changeReason.trim() || '管理者による代理変更';

    setIsSubmitting(true);

    try {
      const isSaturday = new Date(editingCell.dateStr.replace(/-/g, '/')).getDay() === 6;
      const menuVal = newAttendance === '休み' || newLunchStatus === 'なし' || !isSaturday ? null : newLunchMenuId;

      await onUpdateReservations(
        editingCell.employee.id,
        [
          {
            date: editingCell.dateStr,
            attendance: newAttendance,
            lunchStatus: newAttendance === '休み' ? 'なし' : newLunchStatus,
            lunchMenuId: menuVal,
            status: 'confirmed',
          },
        ],
        `【管理者代理変更】${finalReason}`
      );
    } catch (err) {
      console.error('Failed to save cell edit:', err);
    } finally {
      setIsSubmitting(false);
      setEditingCell(null);
    }
  };

  // Lock entire month action
  const handleBatchLockMonth = async (lockStatus: 'confirmed' | 'locked') => {
    const msg =
      lockStatus === 'locked'
        ? `${selectedMonth}月分の全社員予約を一括ロック（編集不可）にしますか？`
        : `${selectedMonth}月分の全社員予約のロックを解除しますか？`;

    if (confirm(msg)) {
      await onConfirmMonth('', selectedMonth, lockStatus);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRegId = toHalfWidth(regId.trim());
    if (!cleanRegId || !regName.trim()) {
      alert('社員IDと氏名を入力してください。');
      return;
    }

    const finalDept = regDepartment === 'OTHER' ? regCustomDept.trim() : regDepartment;
    if (!finalDept) {
      alert('部署名を入力してください。');
      return;
    }

    if (onRegisterEmployee) {
      setIsRegistering(true);
      const success = await onRegisterEmployee({
        id: cleanRegId,
        name: regName.trim(),
        department: finalDept,
        role: regRole,
      });
      setIsRegistering(false);

      if (success) {
        setIsRegisterModalOpen(false);
        setRegId('');
        setRegName('');
        setRegCustomDept('');
      }
    }
  };

  // Guard for Non-Admins trying to open Admin View directly
  if (currentEmployee.role !== 'admin') {
    return (
      <div className="bg-white rounded-2xl p-8 border border-amber-200 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">管理者権限が必要です</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          全社員出勤マトリクスの閲覧および新規社員の初期登録機能は、管理者アカウント専用です。
        </p>
        <div className="text-xs font-semibold text-indigo-700 bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-left">
          💡 アクセス方法：<br />
          全社一覧を管理・閲覧するには、一度ログアウトし、管理者アカウント（例: ID <strong>EMP001</strong> / パスワード <strong>1234</strong>）でログインし直してください。
        </div>
      </div>
    );
  }

  // Stats calculations for Today
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const todayStats = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let lunch = 0;

    reservations.forEach((r) => {
      if (r.date === todayStr) {
        if (r.attendance === '午前' || r.attendance === 'フル') morning++;
        if (r.attendance === '午後' || r.attendance === 'フル') afternoon++;
        if (r.lunchStatus === 'あり') lunch++;
      }
    });

    return {
      totalEmployees: employees.length,
      morningCount: morning,
      afternoonCount: afternoon,
      lunchOrders: lunch,
    };
  }, [employees, reservations, todayStr]);

  return (
    <div className="space-y-6 pb-12">
      {/* Stat Cards - Professional Polish Design */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            全登録社員数
          </span>
          <span className="text-2xl font-bold text-slate-800">{todayStats.totalEmployees}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            午前出勤 (本日)
          </span>
          <span className="text-2xl font-bold text-indigo-600">{todayStats.morningCount}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            午後出勤 (本日)
          </span>
          <span className="text-2xl font-bold text-indigo-600">{todayStats.afternoonCount}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            昼食注文数 (本日)
          </span>
          <span className="text-2xl font-bold text-emerald-600">{todayStats.lunchOrders}</span>
        </div>
      </div>

      {/* Admin Header & Filters */}
      <div className="bg-white rounded-xl p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-indigo-700" />
              <h2 className="text-xl font-bold text-slate-900">管理者画面（全社員一括マトリクス）</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              縦列：登録社員 / 横列：日付および出勤・昼食ステータス。セルクリックで代理変更・履歴ログ登録が可能です。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Month switch */}
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSelectedMonth(currentMonthStr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedMonth === currentMonthStr ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                当月 ({currentMonthStr})
              </button>
              <button
                onClick={() => setSelectedMonth(nextMonthStr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedMonth === nextMonthStr ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                次月 ({nextMonthStr})
              </button>
            </div>

            {/* Bulk Data Import Button (Admin Only) */}
            <button
              onClick={() => setIsBulkImportModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              title="CSVアップロードまたはExcelコピペによる職員やシフトの一括登録"
            >
              <UploadCloud className="h-4 w-4 text-indigo-100" />
              <span>📥 一括データ登録（CSV/コピペ）</span>
            </button>

            {/* Initial Employee Register Button (Admin Only) */}
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>＋ 1件ずつ登録</span>
            </button>

            {/* Lunch Menu Management Button (Admin Only) */}
            <button
              onClick={() => {
                resetMenuForm();
                setIsMenuModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Utensils className="h-3.5 w-3.5 text-amber-100" />
              <span>＋ 弁当メニュー管理</span>
            </button>

            <button
              onClick={() => handleBatchLockMonth('locked')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>全社員月間ロック</span>
            </button>

            <button
              onClick={() => handleBatchLockMonth('confirmed')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Unlock className="h-3.5 w-3.5 text-indigo-600" />
              <span>ロック解除</span>
            </button>

            <button
              onClick={onOpenCSVModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="職員名簿、出勤マトリクス、昼食発注集計、監査ログのCSVダウンロード"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSVダウンロード</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="社員名または社員IDで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
            >
              <option value="ALL">すべての部署</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <a
              href="/api/export/csv?type=employees"
              download="employees_master.csv"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
              title="登録されている全職員の情報をCSVでダウンロード"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>職員名簿CSV保存</span>
            </a>
          </div>
        </div>
      </div>

      {/* Grid Matrix Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] relative">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header - Professional Polish Theme */}
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
              <tr>
                <th className="p-3.5 font-bold uppercase text-[10px] tracking-wider text-slate-400 border-r border-slate-200 sticky left-0 z-30 bg-slate-50 min-w-[160px]">
                  Employee Name
                </th>
                {daysInMonth.map(({ dateStr, dayNum, dayOfWeekStr, isWeekend }) => (
                  <th
                    key={dateStr}
                    className={`p-2 text-center border-r border-slate-200 font-bold min-w-[76px] ${
                      isWeekend ? (dayOfWeekStr === '日' ? 'bg-rose-50/80 text-rose-600' : 'bg-blue-50/80 text-blue-600') : ''
                    }`}
                  >
                    <div className="text-xs font-bold uppercase">{dayNum}日</div>
                    <div className="text-[10px] text-slate-400 font-normal">({dayOfWeekStr})</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Sticky Employee Header Column */}
                  <td className="p-3 font-bold border-r border-slate-200 sticky left-0 z-10 bg-white shadow-2xs">
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center space-x-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${emp.avatarColor}`} />
                        <div>
                          <div className="text-slate-900 leading-tight flex items-center gap-1">
                            <span>{emp.name}</span>
                            {emp.role === 'admin' && (
                              <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded border border-indigo-200">
                                管理者
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-normal text-slate-400">
                            {emp.id} • {emp.department}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: Edit & Delete Employee */}
                      <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-all ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditEmployeeModal(emp);
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-all"
                          title={`利用者「${emp.name}」の登録情報・ID・パスワードの修理（修正）`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        {onDeleteEmployee && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingEmployee(emp);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-all"
                            title={`利用者「${emp.name}」を削除`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Day Cells */}
                  {daysInMonth.map(({ dateStr, isWeekend }) => {
                    const res = reservations.find((r) => r.employeeId === emp.id && r.date === dateStr);
                    const menu = lunchMenus.find((m) => m.id === res?.lunchMenuId);

                    const att = res?.attendance || '休み';
                    const lunch = res?.lunchStatus || 'なし';

                    const getBadgeClass = (status: AttendanceStatus) => {
                      if (status === 'フル' || status === 'フル（遅刻）' || status === 'フル（早退）') {
                        return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
                      }
                      if (
                        status === '午前' ||
                        status === '午前（遅刻）' ||
                        status === '午前（早退）' ||
                        status === '午後' ||
                        status === '午後（遅刻）' ||
                        status === '午後（早退）'
                      ) {
                        return 'bg-amber-100 text-amber-800 border border-amber-300';
                      }
                      if (status === '当欠（身体）' || status === '当欠（精神）' || status === '当欠（私用）') {
                        return 'bg-rose-100 text-rose-800 border border-rose-300 font-bold';
                      }
                      if (status === '加欠（身体）' || status === '加欠（精神）') {
                        return 'bg-purple-100 text-purple-800 border border-purple-300 font-bold';
                      }
                      if (status === '無断') {
                        return 'bg-red-200 text-red-900 border border-red-400 font-bold';
                      }
                      return 'bg-slate-100 text-slate-500 border border-slate-200';
                    };

                    return (
                      <td
                        key={dateStr}
                        onClick={() => handleOpenEditCell(emp, dateStr)}
                        className={`p-1.5 text-center border-r border-slate-200/80 cursor-pointer transition-colors ${
                          isWeekend ? 'bg-slate-50/60' : ''
                        } hover:bg-indigo-50/80`}
                        title={`クリックして予約を代理編集/キャンセル (${emp.name} - ${dateStr})`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-1">
                          {/* Attendance Badge */}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getBadgeClass(att)}`}>
                            {att}
                          </span>

                          {/* Lunch Badge */}
                          {att !== '休み' && (
                            <span
                              className={`text-[9px] font-medium px-1 rounded flex items-center gap-0.5 ${
                                lunch === 'あり'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              <Utensils className="h-2.5 w-2.5" />
                              {lunch === 'あり' ? `[${menu?.code || 'あり'}]` : 'なし'}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Before / After Diff Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveCellEdit();
            }}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">予約変更・キャンセル登録（代理操作）</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  対象社員: <strong>{editingCell.employee.name}</strong> ({editingCell.employee.department}) / 日付: {editingCell.dateStr}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Before vs After Visual Comparison Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>変更前後のビジュアル確認 (履歴に自動記録されます)</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Before */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">変更前 (BEFORE)</div>
                  <div className="mt-1 font-bold text-slate-800">
                    出勤: {editingCell.existingRes?.attendance || '休み'}
                  </div>
                  <div className="text-slate-600">
                    昼食: {editingCell.existingRes?.lunchStatus || 'なし'}
                  </div>
                  {editingCell.existingRes?.lunchMenuId && (
                    <div className="text-[11px] text-indigo-600 truncate mt-1">
                      {lunchMenus.find((m) => m.id === editingCell.existingRes?.lunchMenuId)?.name}
                    </div>
                  )}
                </div>

                {/* After */}
                <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase">変更後 (AFTER)</div>
                  <div className="mt-1 font-bold text-indigo-950">出勤: {newAttendance}</div>
                  <div className="text-indigo-900">
                    昼食: {newAttendance === '休み' ? 'なし' : newLunchStatus}
                  </div>
                  {newAttendance !== '休み' && newLunchStatus === 'あり' && new Date(editingCell.dateStr.replace(/-/g, '/')).getDay() === 6 && (
                    <div className="text-[11px] text-indigo-700 font-medium truncate mt-1">
                      {lunchMenus.find((m) => m.id === newLunchMenuId)?.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  出勤区分の選択 <span className="text-[11px] font-normal text-slate-400">（管理者拡張選択可）</span>
                </label>
                <select
                  value={newAttendance}
                  onChange={(e) => setNewAttendance(e.target.value as AttendanceStatus)}
                  className="w-full text-xs font-bold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                >
                  <optgroup label="【標準区分】">
                    <option value="フル">フル出勤</option>
                    <option value="午前">午前出勤</option>
                    <option value="午後">午後出勤</option>
                    <option value="休み">休み</option>
                  </optgroup>
                  <optgroup label="【遅刻・早退】">
                    <option value="フル（遅刻）">フル（遅刻）</option>
                    <option value="フル（早退）">フル（早退）</option>
                    <option value="午前（遅刻）">午前（遅刻）</option>
                    <option value="午前（早退）">午前（早退）</option>
                    <option value="午後（遅刻）">午後（遅刻）</option>
                    <option value="午後（早退）">午後（早退）</option>
                  </optgroup>
                  <optgroup label="【当欠・加欠・無断】">
                    <option value="当欠（身体）">当欠（身体）</option>
                    <option value="当欠（精神）">当欠（精神）</option>
                    <option value="当欠（私用）">当欠（私用）</option>
                    <option value="加欠（身体）">加欠（身体）</option>
                    <option value="加欠（精神）">加欠（精神）</option>
                    <option value="無断">無断</option>
                  </optgroup>
                </select>
              </div>

              {newAttendance !== '休み' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">昼食予約の選択</label>
                    <div className="flex gap-2">
                      {(['あり', 'なし'] as LunchStatus[]).map((ls) => (
                        <button
                          key={ls}
                          type="button"
                          onClick={() => setNewLunchStatus(ls)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            newLunchStatus === ls
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          昼食{ls}
                        </button>
                      ))}
                    </div>
                  </div>

                  {newLunchStatus === 'あり' && new Date(editingCell.dateStr.replace(/-/g, '/')).getDay() === 6 && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">土曜昼食メニュー</label>
                      <select
                        value={newLunchMenuId}
                        onChange={(e) => setNewLunchMenuId(e.target.value)}
                        className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-slate-50"
                      >
                        {lunchMenus.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.code}] {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>変更・キャンセル理由</span>
                  <span className="text-[10px] text-slate-400 font-normal">※未記入時は自動で記録</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 急な体調不良のため、外勤変更のためなど"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 mb-1.5"
                />
                
                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {['急な体調不良', '業務都合（外勤・出張）', '時間変更', '代理申請・キャンセル'].map((reasonPreset) => (
                    <button
                      key={reasonPreset}
                      type="button"
                      onClick={() => setChangeReason(reasonPreset)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[10px] font-medium rounded-md border border-slate-200 transition-colors"
                    >
                      + {reasonPreset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSubmitting ? '保存処理中...' : '変更を履歴に記録して保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Only: Employee Initial Registration Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <UserPlus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">社員初期登録 (管理者権限)</h3>
                  <p className="text-[11px] text-slate-400">名前やIDの新規設定・出勤管理マスターへの登録</p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  社員ID（ログインID） <span className="text-rose-500">*</span> <span className="text-[10px] font-normal text-slate-500">（半角英数・全角英数ともに可）</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: EMP006 または emp006"
                  value={regId}
                  onChange={(e) => setRegId(e.target.value)}
                  onBlur={() => setRegId((prev) => toHalfWidth(prev))}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-text"
                />
                <span className="text-[10px] text-slate-400 block mt-1">※半角英数字（大文字・小文字）・全角英数字のどちらでも入力可能です</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  社員氏名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 中村 健太"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  所属部署 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 mb-2"
                >
                  <option value="開発部">開発部</option>
                  <option value="営業部">営業部</option>
                  <option value="総務部">総務部</option>
                  <option value="カスタマーサクセス部">カスタマーサクセス部</option>
                  <option value="OTHER">その他（自由入力）</option>
                </select>

                {regDepartment === 'OTHER' && (
                  <input
                    type="text"
                    required
                    placeholder="新しい部署名を入力"
                    value={regCustomDept}
                    onChange={(e) => setRegCustomDept(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  システム権限 <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRegRole('employee')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      regRole === 'employee'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold">一般社員 (利用者)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">自分の予約・確定のみ</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegRole('admin')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      regRole === 'admin'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold">管理者 (Admin)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">全社マトリクス & 社員登録</div>
                  </button>
                </div>
              </div>

              {/* Registered Employee List & Deletion Section */}
              <div className="pt-4 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 block mb-2 flex items-center justify-between">
                  <span>登録済み利用者（社員）の管理・削除</span>
                  <span className="text-[10px] text-slate-400 font-normal">全 {employees.length} 名</span>
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${emp.avatarColor}`} />
                        <div>
                          <div className="font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                            <span>{emp.name}</span>
                            {emp.role === 'admin' && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1 rounded">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {emp.id} • {emp.department}
                          </div>
                        </div>
                      </div>

                      {onDeleteEmployee && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsRegisterModalOpen(false);
                            setDeletingEmployee(emp);
                          }}
                          className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition-all flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>削除</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{isRegistering ? '登録処理中...' : '初期登録を確定'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Info Modal (Admin Only) */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <Edit3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">登録情報の修正・編集</h3>
                  <p className="text-[11px] text-slate-400">対象: {editingEmployee.name} ({editingEmployee.id})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateEmployeeSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ログインID（社員ID） <span className="text-rose-500">*</span> <span className="text-[10px] font-normal text-slate-500">（半角英数・全角英数ともに可）</span>
                </label>
                <input
                  type="text"
                  required
                  value={editId}
                  onChange={(e) => setEditId(e.target.value)}
                  onBlur={() => setEditId((prev) => toHalfWidth(prev))}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-text"
                />
                <span className="text-[10px] text-slate-400 block mt-1">※半角英数字（大文字・小文字）・全角英数字のどちらでも入力可能です。ID変更時は過去ログ等も更新されます。</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ログインパスワード <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  氏名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  所属部署 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="開発部">開発部</option>
                  <option value="製造部">製造部</option>
                  <option value="営業部">営業部</option>
                  <option value="総務部">総務部</option>
                  <option value="サポート部">サポート部</option>
                  <option value="OTHER">その他（手入力）</option>
                </select>

                {editDepartment === 'OTHER' && (
                  <input
                    type="text"
                    required
                    placeholder="部署名を入力してください"
                    value={editCustomDept}
                    onChange={(e) => setEditCustomDept(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 mt-2"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  権限区分 <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRole('employee')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      editRole === 'employee'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    一般社員
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRole('admin')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      editRole === 'admin'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    管理者 (全権限)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">メールアドレス</label>
                <input
                  type="email"
                  placeholder="例: user@company.co.jp"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEmployee}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{isUpdatingEmployee ? '保存中...' : '修正内容を保存'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">利用者の削除</h3>
                <p className="text-xs text-slate-500">社員アカウントの削除確認</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-900 leading-relaxed">
              社員 <strong>「{deletingEmployee.name}」</strong> (ID: {deletingEmployee.id}) をシステムから削除しますか？
              <br />
              <span className="text-[11px] text-rose-700 font-semibold block mt-1">
                ※この操作を実行すると、対象社員の予約データおよび履歴も削除されます。
              </span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (onDeleteEmployee && deletingEmployee) {
                    setIsDeleting(true);
                    const success = await onDeleteEmployee(deletingEmployee.id);
                    setIsDeleting(false);
                    if (success) {
                      setDeletingEmployee(null);
                    }
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isDeleting ? '削除中...' : '削除を実行'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Only: Lunch Menu Management Modal */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500 rounded-lg">
                  <Utensils className="h-5 w-5 text-slate-950" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">弁当メニュー登録・管理 (管理者権限)</h3>
                  <p className="text-[11px] text-slate-400">土曜日などの特別メニュー追加・価格や内容の編集・削除</p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {menuFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-between">
                  <span>{menuFormError}</span>
                  <button onClick={() => setMenuFormError(null)} className="text-rose-500 hover:text-rose-800">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Delete Menu Confirmation Alert Area */}
              {deletingMenuTarget && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-rose-900">
                        メニューの削除確認
                      </h4>
                      <p className="text-xs text-rose-700 mt-0.5">
                        「[{deletingMenuTarget.code}] {deletingMenuTarget.name}（¥{deletingMenuTarget.price.toLocaleString()}）」を削除してもよろしいですか？
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDeletingMenuTarget(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingMenu}
                      onClick={handleConfirmDeleteMenu}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-1"
                    >
                      <span>{isDeletingMenu ? '削除中...' : 'はい、削除します'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Top Form: Add or Edit Menu */}
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                    <PlusCircle className="h-4 w-4 text-amber-600" />
                    <span>{editingMenuId ? '選択中メニューの編集' : '新規弁当メニューの追加'}</span>
                  </h4>
                  {editingMenuId && (
                    <button
                      type="button"
                      onClick={resetMenuForm}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
                    >
                      新規追加モードに戻る
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveMenuSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        メニューコード <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="例: SAT1 または F"
                        value={menuCode}
                        onChange={(e) => setMenuCode(e.target.value)}
                        onBlur={() => setMenuCode((prev) => toHalfWidth(prev).toUpperCase())}
                        className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">※半角英数字 (例: A, SAT1)</span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        メニュー名 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="例: 土曜特別幕の内弁当 (天ぷら・手作り玉子焼き入り)"
                        value={menuName}
                        onChange={(e) => setMenuName(e.target.value)}
                        className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">カテゴリ</label>
                      <select
                        value={menuCategory}
                        onChange={(e) => setMenuCategory(e.target.value)}
                        className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="土曜限定">土曜限定</option>
                        <option value="肉料理">肉料理</option>
                        <option value="魚料理">魚料理</option>
                        <option value="ヘルシー">ヘルシー</option>
                        <option value="カレー">カレー</option>
                        <option value="麺類">麺類</option>
                        <option value="OTHER">その他（自由入力）</option>
                      </select>
                      {menuCategory === 'OTHER' && (
                        <input
                          type="text"
                          required
                          placeholder="カテゴリ名を入力"
                          value={menuCustomCategory}
                          onChange={(e) => setMenuCustomCategory(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-xl bg-white text-slate-900 mt-2"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        価格 (円) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={10}
                        placeholder="650"
                        value={menuPrice}
                        onChange={(e) => setMenuPrice(Number(e.target.value))}
                        className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-end">
                      <button
                        type="submit"
                        disabled={isSavingMenu}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>{isSavingMenu ? '保存中...' : editingMenuId ? 'メニューを更新' : '＋ 新規メニューを追加'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">詳細説明・おしながき</label>
                    <input
                      type="text"
                      placeholder="例: 土曜日限定の贅沢お弁当。地場野菜と手作りのおかずを詰めた特製セットです。"
                      value={menuDescription}
                      onChange={(e) => setMenuDescription(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </form>
              </div>

              {/* Bottom List: Registered Menus List */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between border-b border-slate-200 pb-2">
                  <span>現在登録されている弁当メニュー一覧 ({lunchMenus.length}件)</span>
                  <span className="text-[11px] font-normal text-slate-500">※編集ボタンを押すと上のフォームに読み込まれます</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lunchMenus.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        editingMenuId === m.id
                          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 bg-slate-900 text-amber-300 font-extrabold text-xs rounded-md">
                              コード {m.code}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md">
                              {m.category}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-emerald-700">
                            ¥{m.price.toLocaleString()}
                          </span>
                        </div>

                        <h5 className="font-bold text-xs text-slate-900 leading-snug">{m.name}</h5>
                        {m.description && (
                          <p className="text-[11px] text-slate-500 leading-tight">{m.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-3 mt-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => handleOpenEditMenu(m)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition-colors flex items-center space-x-1"
                        >
                          <Edit3 className="h-3 w-3 text-indigo-600" />
                          <span>編集</span>
                        </button>

                        <button
                          type="button"
                          disabled={lunchMenus.length <= 1}
                          onClick={() => setDeletingMenuTarget(m)}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold rounded-lg transition-colors flex items-center space-x-1 disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>削除</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        currentEmployee={currentEmployee}
        employees={employees}
        onRefreshData={onRefreshData || (() => {})}
      />
    </div>
  );
};
