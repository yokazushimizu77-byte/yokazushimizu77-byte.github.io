import React, { useState, useMemo } from 'react';
import {
  Employee,
  Reservation,
  LunchMenu,
  AttendanceStatus,
  LunchStatus,
  DaySummary,
} from '../types';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Lock,
  Unlock,
  Utensils,
  Sun,
  Clock,
  Briefcase,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Users,
} from 'lucide-react';

interface UserReservationViewProps {
  currentEmployee: Employee;
  employees: Employee[];
  reservations: Reservation[];
  lunchMenus: LunchMenu[];
  onUpdateReservations: (
    employeeId: string,
    updates: (Partial<Reservation> & { date: string })[],
    reason?: string
  ) => Promise<void>;
  onConfirmMonth: (employeeId: string, month: string) => Promise<void>;
}

export const UserReservationView: React.FC<UserReservationViewProps> = ({
  currentEmployee,
  employees,
  reservations,
  lunchMenus,
  onUpdateReservations,
  onConfirmMonth,
}) => {
  // Current Month State (YYYY-MM)
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const nextMonthObj = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthObj.getFullYear()}-${String(nextMonthObj.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isConfirmingModalOpen, setIsConfirmingModalOpen] = useState<boolean>(false);
  const [batchAttendance, setBatchAttendance] = useState<AttendanceStatus>('フル');
  const [batchLunchStatus, setBatchLunchStatus] = useState<LunchStatus>('あり');
  const [batchLunchMenuId, setBatchLunchMenuId] = useState<string>(lunchMenus[0]?.id || 'MENU_A');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [reasonInput, setReasonInput] = useState<string>('');
  const [unlockRequestDate, setUnlockRequestDate] = useState<string | null>(null);

  // Calculate year & month
  const [yearStr, monthNumStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);

  // Generate days in selected month
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

  // Compute daily summaries across ALL employees
  const dailySummaries = useMemo<Record<string, DaySummary>>(() => {
    const map: Record<string, DaySummary> = {};

    daysInMonth.forEach(({ dateStr, dayOfWeekStr, isWeekend }) => {
      let morning = 0;
      let afternoon = 0;
      let full = 0;
      let off = 0;
      let lunchCount = 0;
      const breakdown: Record<string, number> = {};

      reservations.forEach((r) => {
        if (r.date === dateStr) {
          const att = r.attendance;
          if (att === '午前' || att === '午前（遅刻）' || att === '午前（早退）') {
            morning++;
          } else if (att === '午後' || att === '午後（遅刻）' || att === '午後（早退）') {
            afternoon++;
          } else if (att === 'フル' || att === 'フル（遅刻）' || att === 'フル（早退）') {
            full++;
          } else {
            off++;
          }

          if (r.lunchStatus === 'あり') {
            lunchCount++;
            if (r.lunchMenuId) {
              breakdown[r.lunchMenuId] = (breakdown[r.lunchMenuId] || 0) + 1;
            }
          }
        }
      });

      map[dateStr] = {
        date: dateStr,
        dayOfWeek: dayOfWeekStr,
        isWeekend,
        morningCount: morning,
        afternoonCount: afternoon,
        fullCount: full,
        offCount: off,
        totalWorking: full + morning + afternoon,
        lunchCount,
        lunchMenuBreakdown: breakdown,
      };
    });

    return map;
  }, [daysInMonth, reservations]);

  // Map user's own reservations
  const userReservationMap = useMemo(() => {
    const map: Record<string, Reservation> = {};
    reservations.forEach((r) => {
      if (r.employeeId === currentEmployee.id) {
        map[r.date] = r;
      }
    });
    return map;
  }, [reservations, currentEmployee.id]);

  // Check overall month confirmation status for user
  const isMonthConfirmed = useMemo(() => {
    const userResArray = Object.values(userReservationMap) as Reservation[];
    const currentMonthRes = userResArray.filter((r) => r.date.startsWith(selectedMonth));
    if (currentMonthRes.length === 0) return false;
    return currentMonthRes.every((r) => r.status === 'confirmed' || r.status === 'locked');
  }, [userReservationMap, selectedMonth]);

  // Single date handler
  const handleSingleFieldChange = async (
    dateStr: string,
    field: 'attendance' | 'lunchStatus' | 'lunchMenuId',
    value: any
  ) => {
    const currentRes = userReservationMap[dateStr];

    if (currentRes?.status === 'locked' && currentEmployee.role !== 'admin') {
      alert('この日付の予約は確定・ロックされています。内容を変更するには管理者に修正申請してください。');
      return;
    }

    const currentAtt = currentRes?.attendance || 'フル';
    const currentLunch = currentRes?.lunchStatus || 'あり';
    const currentMenu = currentRes?.lunchMenuId || lunchMenus[0]?.id || null;

    let newAtt = currentAtt;
    let newLunch = currentLunch;
    let newMenu = currentMenu;

    if (field === 'attendance') {
      newAtt = value;
      if (value === '休み') {
        newLunch = 'なし';
        newMenu = null;
      }
    } else if (field === 'lunchStatus') {
      newLunch = value;
      const isSaturday = new Date(dateStr.replace(/-/g, '/')).getDay() === 6;
      if (value === 'あり') {
        if (isSaturday) {
          if (!newMenu) newMenu = lunchMenus[0]?.id || null;
        } else {
          newMenu = null;
        }
      } else if (value === 'なし') {
        newMenu = null;
      }
    } else if (field === 'lunchMenuId') {
      newMenu = value;
      if (value) newLunch = 'あり';
    }

    setIsSaving(true);
    await onUpdateReservations(currentEmployee.id, [
      {
        date: dateStr,
        attendance: newAtt,
        lunchStatus: newLunch,
        lunchMenuId: newMenu,
        status: currentRes?.status || 'draft',
      },
    ]);
    setIsSaving(false);
  };

  // Select all weekdays toggle
  const handleSelectAllWeekdays = () => {
    const weekdays = daysInMonth.filter((d) => !d.isWeekend).map((d) => d.dateStr);
    const allSelected = weekdays.every((d) => selectedDates.includes(d));
    if (allSelected) {
      setSelectedDates([]);
    } else {
      setSelectedDates(weekdays);
    }
  };

  // Batch apply selection
  const handleApplyBatchUpdate = async () => {
    if (selectedDates.length === 0) return;

    setIsSaving(true);
    const updates = selectedDates.map((dateStr) => {
      const isSaturday = new Date(dateStr.replace(/-/g, '/')).getDay() === 6;
      const isLunch = batchAttendance !== '休み' && batchLunchStatus === 'あり';
      return {
        date: dateStr,
        attendance: batchAttendance,
        lunchStatus: batchAttendance === '休み' ? ('なし' as LunchStatus) : batchLunchStatus,
        lunchMenuId: isLunch && isSaturday ? batchLunchMenuId : null,
        status: 'draft' as const,
      };
    });

    await onUpdateReservations(currentEmployee.id, updates, reasonInput || '一括更新適用');
    setSelectedDates([]);
    setReasonInput('');
    setIsSaving(false);
  };

  // Month confirmation submit
  const handleConfirmMonthSubmit = async () => {
    setIsSaving(true);
    await onConfirmMonth(currentEmployee.id, selectedMonth);
    setIsSaving(false);
    setIsConfirmingModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Month Selector & Main Control Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Month Switch Tabs */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              対象月の選択 (当月・次月対応)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedMonth(currentMonthStr)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 border ${
                  selectedMonth === currentMonthStr
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CalendarIcon className="h-4 w-4" />
                <span>当月 ({currentMonthStr.replace('-', '年')}月)</span>
                {selectedMonth === currentMonthStr && (
                  <span className="ml-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    現在
                  </span>
                )}
              </button>

              <button
                onClick={() => setSelectedMonth(nextMonthStr)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 border ${
                  selectedMonth === nextMonthStr
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CalendarIcon className="h-4 w-4" />
                <span>次月 ({nextMonthStr.replace('-', '年')}月)</span>
              </button>
            </div>
          </div>

          {/* Status Badge & Lock Action */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div>
              <div className="text-xs text-slate-500">現在の確定ステータス</div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                {isMonthConfirmed ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    {selectedMonth}月 確定済み
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock className="h-3.5 w-3.5 mr-1 text-amber-600" />
                    {selectedMonth}月 未確定 (下書き)
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsConfirmingModalOpen(true)}
              disabled={isMonthConfirmed}
              className={`ml-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all ${
                isMonthConfirmed
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              {isMonthConfirmed ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>予約確定済み</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{selectedMonth}月分の予約を確定する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Batch Select Toolbar */}
      <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100/80 text-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAllWeekdays}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 shadow-sm hover:bg-indigo-50 transition-colors"
            >
              <CheckSquare className="h-4 w-4 text-indigo-600" />
              <span>平日を一括選択/解除</span>
            </button>
            <span className="text-xs text-indigo-900 font-medium">
              選択中: <strong className="text-indigo-700 font-bold">{selectedDates.length}</strong> 日
            </span>
          </div>

          {/* Batch Controls */}
          {selectedDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-indigo-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-600 px-1">一括設定:</span>

              {/* Attendance */}
              <select
                value={batchAttendance}
                onChange={(e) => setBatchAttendance(e.target.value as AttendanceStatus)}
                className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
              >
                {currentEmployee.role === 'admin' ? (
                  <>
                    <optgroup label="【標準区分】">
                      <option value="フル">フル出勤</option>
                      <option value="午前">午前出勤</option>
                      <option value="午後">午後出勤</option>
                      <option value="休み">休み</option>
                    </optgroup>
                    <optgroup label="【遅刻・早退 (管理者権限)】">
                      <option value="フル（遅刻）">フル（遅刻）</option>
                      <option value="フル（早退）">フル（早退）</option>
                      <option value="午前（遅刻）">午前（遅刻）</option>
                      <option value="午前（早退）">午前（早退）</option>
                      <option value="午後（遅刻）">午後（遅刻）</option>
                      <option value="午後（早退）">午後（早退）</option>
                    </optgroup>
                    <optgroup label="【当欠・加欠・無断 (管理者権限)】">
                      <option value="当欠（身体）">当欠（身体）</option>
                      <option value="当欠（精神）">当欠（精神）</option>
                      <option value="当欠（私用）">当欠（私用）</option>
                      <option value="加欠（身体）">加欠（身体）</option>
                      <option value="加欠（精神）">加欠（精神）</option>
                      <option value="無断">無断</option>
                    </optgroup>
                  </>
                ) : (
                  <>
                    <option value="フル">フル出勤</option>
                    <option value="午前">午前出勤</option>
                    <option value="午後">午後出勤</option>
                    <option value="休み">休み</option>
                  </>
                )}
              </select>

              {/* Lunch Status */}
              {batchAttendance !== '休み' && (
                <>
                  <select
                    value={batchLunchStatus}
                    onChange={(e) => setBatchLunchStatus(e.target.value as LunchStatus)}
                    className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="あり">昼食あり</option>
                    <option value="なし">昼食なし</option>
                  </select>

                  {batchLunchStatus === 'あり' && selectedDates.some((d) => new Date(d.replace(/-/g, '/')).getDay() === 6) && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-indigo-700 font-bold">土曜メニュー:</span>
                      <select
                        value={batchLunchMenuId}
                        onChange={(e) => setBatchLunchMenuId(e.target.value)}
                        className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 max-w-[180px] truncate focus:ring-2 focus:ring-indigo-500"
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

              <button
                onClick={handleApplyBatchUpdate}
                disabled={isSaving}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center space-x-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>選択した日に適用</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Reservation Calendar Table View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Notice Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <Info className="h-4 w-4 text-indigo-600 flex-shrink-0" />
            <span>
              各日付のヘッダーに<strong>最新のチーム全体の予約状況</strong>（午前予約数・午後予約数・合計数・昼食注文数）をリアルタイム表示しています。
            </span>
          </div>
          <div className="hidden sm:flex items-center space-x-3 text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span> フル出勤
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span> 午前/午後
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400"></span> 休み
            </span>
          </div>
        </div>

        {/* Date Rows / List */}
        <div className="divide-y divide-slate-200/70">
          {daysInMonth.map(({ dateStr, dayNum, dayOfWeekStr, isWeekend }) => {
            const summary = dailySummaries[dateStr];
            const userRes = userReservationMap[dateStr];
            const isSelected = selectedDates.includes(dateStr);
            const isLocked = userRes?.status === 'locked' || userRes?.status === 'confirmed';

            const userAtt = userRes?.attendance || 'フル';
            const userLunch = userRes?.lunchStatus || 'あり';
            const userMenuId = userRes?.lunchMenuId || lunchMenus[0]?.id || '';

            return (
              <div
                key={dateStr}
                className={`p-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isWeekend
                    ? 'bg-slate-50/70 hover:bg-slate-100/60'
                    : isSelected
                    ? 'bg-indigo-50/40 hover:bg-indigo-50/70'
                    : 'hover:bg-slate-50/50'
                }`}
              >
                {/* Left: Date & Team Statistics */}
                <div className="flex items-start sm:items-center space-x-4 min-w-[320px]">
                  {/* Select Checkbox */}
                  <button
                    onClick={() => {
                      if (selectedDates.includes(dateStr)) {
                        setSelectedDates(selectedDates.filter((d) => d !== dateStr));
                      } else {
                        setSelectedDates([...selectedDates, dateStr]);
                      }
                    }}
                    className="mt-0.5 sm:mt-0 p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-indigo-600" />
                    ) : (
                      <Square className="h-5 w-5 text-slate-300" />
                    )}
                  </button>

                  {/* Date Badge */}
                  <div
                    className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl font-bold border ${
                      isWeekend
                        ? dayOfWeekStr === '日'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className="text-base leading-none">{dayNum}</span>
                    <span className="text-[10px] mt-0.5">({dayOfWeekStr})</span>
                  </div>

                  {/* Daily Summary Statistics */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-bold text-slate-700">{month}月{dayNum}日({dayOfWeekStr})</span>
                      {isLocked && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                          <Lock className="h-2.5 w-2.5 mr-0.5" /> 確定済
                        </span>
                      )}
                    </div>

                    {/* Overall Team Daily Stats Pill */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium"
                        title="全体出勤予定者数"
                      >
                        <Users className="h-3 w-3 inline mr-1 text-indigo-600" />
                        出勤合計: <strong className="text-slate-900 font-bold">{summary?.totalWorking || 0}</strong>名
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        午前: <strong className="font-bold">{summary?.morningCount + summary?.fullCount}</strong>名
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                        午後: <strong className="font-bold">{summary?.afternoonCount + summary?.fullCount}</strong>名
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        <Utensils className="h-3 w-3 inline mr-1 text-emerald-600" />
                        昼食注文: <strong className="font-bold">{summary?.lunchCount || 0}</strong>食
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Employee Personal Selections (Attendance & Lunch) */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  {/* Attendance Choice */}
                  <div className="flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-400 mb-1">出勤区分</label>
                    {currentEmployee.role === 'admin' ? (
                      <select
                        value={userAtt}
                        onChange={(e) => handleSingleFieldChange(dateStr, 'attendance', e.target.value)}
                        className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                      >
                        <optgroup label="【標準区分】">
                          <option value="フル">フル出勤</option>
                          <option value="午前">午前出勤</option>
                          <option value="午後">午後出勤</option>
                          <option value="休み">休み</option>
                        </optgroup>
                        <optgroup label="【遅刻・早退 (管理者権限)】">
                          <option value="フル（遅刻）">フル（遅刻）</option>
                          <option value="フル（早退）">フル（早退）</option>
                          <option value="午前（遅刻）">午前（遅刻）</option>
                          <option value="午前（早退）">午前（早退）</option>
                          <option value="午後（遅刻）">午後（遅刻）</option>
                          <option value="午後（早退）">午後（早退）</option>
                        </optgroup>
                        <optgroup label="【当欠・加欠・無断 (管理者権限)】">
                          <option value="当欠（身体）">当欠（身体）</option>
                          <option value="当欠（精神）">当欠（精神）</option>
                          <option value="当欠（私用）">当欠（私用）</option>
                          <option value="加欠（身体）">加欠（身体）</option>
                          <option value="加欠（精神）">加欠（精神）</option>
                          <option value="無断">無断</option>
                        </optgroup>
                      </select>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                          {(['フル', '午前', '午後', '休み'] as AttendanceStatus[]).map((att) => {
                            const isAttSelected = userAtt === att;
                            return (
                              <button
                                key={att}
                                onClick={() => handleSingleFieldChange(dateStr, 'attendance', att)}
                                disabled={isLocked}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                  isAttSelected
                                    ? att === 'フル'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : att === '午前' || att === '午後'
                                      ? 'bg-amber-500 text-white shadow-xs'
                                      : 'bg-slate-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {att}
                              </button>
                            );
                          })}
                        </div>
                        {/* Display badge if current status is a special admin status */}
                        {!['フル', '午前', '午後', '休み'].includes(userAtt) && (
                          <span className="px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                            管理者設定: {userAtt}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Lunch Choice */}
                  {userAtt !== '休み' && (
                    <>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-semibold text-slate-400 mb-1">昼食予約</label>
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                          {(['あり', 'なし'] as LunchStatus[]).map((ls) => {
                            const isLunchSelected = userLunch === ls;
                            return (
                              <button
                                key={ls}
                                onClick={() => handleSingleFieldChange(dateStr, 'lunchStatus', ls)}
                                disabled={isLocked && currentEmployee.role !== 'admin'}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                  isLunchSelected
                                    ? ls === 'あり'
                                      ? 'bg-indigo-600 text-white shadow-xs'
                                      : 'bg-slate-500 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                昼食{ls}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Lunch Menu Choice (Saturdays only) */}
                      {userLunch === 'あり' && dayOfWeekStr === '土' && (
                        <div className="flex flex-col min-w-[200px] max-w-[280px]">
                          <label className="text-[10px] font-semibold text-slate-400 mb-1">土曜メニュー選択</label>
                          <select
                            value={userMenuId}
                            onChange={(e) => handleSingleFieldChange(dateStr, 'lunchMenuId', e.target.value)}
                            disabled={isLocked && currentEmployee.role !== 'admin'}
                            className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-indigo-500 truncate"
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              {selectedMonth}月分 予約内容の最終確定
            </h3>

            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              登録した出勤区分および昼食メニューの予約内容を確定します。<br />
              確定後は内容の直接変更が制限され、管理者への変更依頼フローが必要となります。
            </p>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
              ⚠️ 翌月昼食の発注手続きが進行するため、確実なスケジュールをご確認の上で確定してください。
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={() => setIsConfirmingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmMonthSubmit}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all"
              >
                {isSaving ? '処理中...' : '確定を送信する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
