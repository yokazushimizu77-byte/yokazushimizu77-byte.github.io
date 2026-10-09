import React, { useState, useEffect, useCallback } from 'react';
import {
  Employee,
  LunchMenu,
  Reservation,
  ChangeLog,
  NotificationSetting,
} from './types';
import { Navbar } from './components/Navbar';
import { UserReservationView } from './components/UserReservationView';
import { AdminMatrixView } from './components/AdminMatrixView';
import { ChangeHistoryLogView } from './components/ChangeHistoryLogView';
import { CSVExportModal } from './components/CSVExportModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { RoleAccessModal } from './components/RoleAccessModal';
import { LoginModal } from './components/LoginModal';
import { Bell, Sparkles, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lunchMenus, setLunchMenus] = useState<LunchMenu[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [notificationSetting, setNotificationSetting] = useState<NotificationSetting>({
    enabled: true,
    dailyReminderTime: '17:00',
    deadlineDaysNotice: 1,
  });

  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'admin' | 'logs' | 'security'>('calendar');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);

  // Modal states
  const [isCSVModalOpen, setIsCSVModalOpen] = useState<boolean>(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);

  // Toast Banner State
  const [toast, setToast] = useState<{ message: string; title?: string; type: 'info' | 'success' | 'warning' } | null>(
    null
  );

  const showToast = useCallback((message: string, title?: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message, title, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  }, []);

  // Login & Logout Handlers
  const handleLoginSuccess = (emp: Employee) => {
    setCurrentEmployee(emp);
    localStorage.setItem('hub_logged_in_employee_id', emp.id);
    showToast(`ようこそ、${emp.name}さん (${emp.role === 'admin' ? '管理者' : '一般社員'})。ログインしました。`, 'ログイン完了', 'success');
  };

  const handleLogout = () => {
    setCurrentEmployee(null);
    localStorage.removeItem('hub_logged_in_employee_id');
    setActiveTab('calendar');
    showToast('ログアウトしました。', 'ログアウト完了', 'info');
  };

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/initial-data');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
        setLunchMenus(data.lunchMenus || []);
        setReservations(data.reservations || []);
        setChangeLogs(data.changeLogs || []);
        if (data.notificationSetting) setNotificationSetting(data.notificationSetting);

        // Restore logged in user session if exists in localStorage
        const savedEmpId = localStorage.getItem('hub_logged_in_employee_id');
        if (savedEmpId && data.employees?.length > 0) {
          const found = data.employees.find((e: Employee) => e.id === savedEmpId);
          if (found) {
            setCurrentEmployee(found);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE Stream Setup for Real-Time Syncing Across All Browsers/Tabs
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onopen = () => {
      setIsRealtimeConnected(true);
    };

    eventSource.addEventListener('connected', () => {
      setIsRealtimeConnected(true);
    });

    eventSource.addEventListener('reservation-updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.updatedRecords && Array.isArray(data.updatedRecords)) {
          setReservations((prev) => {
            const copy = [...prev];
            data.updatedRecords.forEach((updated: Reservation) => {
              const idx = copy.findIndex((r) => r.employeeId === updated.employeeId && r.date === updated.date);
              if (idx !== -1) copy[idx] = updated;
              else copy.push(updated);
            });
            return copy;
          });
        }

        if (data.newLogs && Array.isArray(data.newLogs)) {
          setChangeLogs((prev) => [...data.newLogs, ...prev]);
        }

        if (data.modifiedByName) {
          showToast(`「${data.modifiedByName}」さんが予約情報をリアルタイム更新しました。`, 'リアルタイム共有', 'info');
        }
      } catch (err) {
        console.error('Error handling reservation-updated SSE:', err);
      }
    });

    eventSource.addEventListener('batch-confirmed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setReservations((prev) =>
          prev.map((r) => {
            if ((!data.employeeId || r.employeeId === data.employeeId) && r.date.startsWith(data.month)) {
              return { ...r, status: data.status };
            }
            return r;
          })
        );
        if (data.log) {
          setChangeLogs((prev) => [data.log, ...prev]);
        }
        showToast(`「${data.modifiedByName}」さんが${data.month}月分を${data.status === 'locked' ? 'ロック' : '確定'}しました。`, '一括確定通知', 'success');
      } catch (err) {
        console.error('Error handling batch-confirmed SSE:', err);
      }
    });

    eventSource.addEventListener('push-notification', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        showToast(data.message, data.title || '締め切りリマインド通知', 'warning');
      } catch (err) {
        console.error('Error handling push notification SSE:', err);
      }
    });

    eventSource.addEventListener('employee-added', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.employees) {
          setEmployees(data.employees);
        }
        if (data.log) {
          setChangeLogs((prev) => [data.log, ...prev]);
        }
        showToast(
          `管理者「${data.addedByName}」さんが新しい社員「${data.newEmployee?.name} (ID: ${data.newEmployee?.id})」を初期登録しました。`,
          '社員初期登録完了',
          'success'
        );
      } catch (err) {
        console.error('Error handling employee-added SSE:', err);
      }
    });

    eventSource.addEventListener('employee-deleted', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.employees) {
          setEmployees(data.employees);
        }
        if (data.deletedEmployeeId) {
          setReservations((prev) => prev.filter((r) => r.employeeId !== data.deletedEmployeeId));
        }
        if (data.log) {
          setChangeLogs((prev) => [data.log, ...prev]);
        }
        showToast(
          `管理者「${data.deletedByName}」さんが社員「${data.deletedEmpName} (ID: ${data.deletedEmployeeId})」を削除しました。`,
          '社員削除完了',
          'info'
        );
      } catch (err) {
        console.error('Error handling employee-deleted SSE:', err);
      }
    });

    eventSource.addEventListener('employee-updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.employees) {
          setEmployees(data.employees);
        }
        if (data.oldId && data.updatedEmployee && data.oldId !== data.updatedEmployee.id) {
          setReservations((prev) =>
            prev.map((r) => (r.employeeId === data.oldId ? { ...r, employeeId: data.updatedEmployee.id } : r))
          );
        }
        if (data.log) {
          setChangeLogs((prev) => [data.log, ...prev]);
        }
        showToast(
          `管理者「${data.modifiedByName}」さんが利用者「${data.updatedEmployee?.name}」の登録情報を変更しました。`,
          '登録情報修正完了',
          'success'
        );
      } catch (err) {
        console.error('Error handling employee-updated SSE:', err);
      }
    });

    eventSource.addEventListener('lunch-menus-updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.lunchMenus) {
          setLunchMenus(data.lunchMenus);
        }
        if (data.log) {
          setChangeLogs((prev) => [data.log, ...prev]);
        }
        showToast(
          `管理者「${data.modifiedByName}」さんが弁当メニュー情報を更新しました。`,
          'メニュー更新完了',
          'success'
        );
      } catch (err) {
        console.error('Error handling lunch-menus-updated SSE:', err);
      }
    });

    eventSource.addEventListener('employees-bulk-updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.employees) {
          setEmployees(data.employees);
        }
        if (data.log) {
          setChangeLogs((prev) => [data.log, ...prev]);
        }
        fetchData();
        showToast(
          `管理者「${data.modifiedByName}」さんが職員データの一括登録を行いました。（新規: ${data.addedCount}件, 更新: ${data.updatedCount}件）`,
          '一括登録完了',
          'success'
        );
      } catch (err) {
        console.error('Error handling employees-bulk-updated SSE:', err);
      }
    });

    eventSource.addEventListener('reservations-bulk-updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.reservations) {
          setReservations(data.reservations);
        }
        if (data.log) {
          setChangeLogs((prev) => [data.log, ...prev]);
        }
        fetchData();
        showToast(
          `管理者「${data.modifiedByName}」さんが出勤・シフトデータの一括登録を行いました。（${data.successCount}件）`,
          'シフト一括取込完了',
          'success'
        );
      } catch (err) {
        console.error('Error handling reservations-bulk-updated SSE:', err);
      }
    });

    eventSource.onerror = () => {
      setIsRealtimeConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [showToast]);

  // Initial Employee Registration Handler (Admin Only)
  const handleRegisterEmployee = async (newEmp: { id: string; name: string; department: string; role: 'admin' | 'employee' }) => {
    if (!currentEmployee || currentEmployee.role !== 'admin') {
      alert('初期登録は管理者のみ実行できます。');
      return false;
    }

    try {
      const res = await fetch('/api/employees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEmp,
          modifiedById: currentEmployee.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '登録に失敗しました');
        return false;
      }

      if (data.employees) {
        setEmployees(data.employees);
      }

      // Refresh data to fetch auto-generated reservations
      fetchData();
      showToast(`社員「${newEmp.name} (${newEmp.id})」の初期登録が完了しました。`, '登録成功', 'success');
      return true;
    } catch (err) {
      console.error('Failed to register employee:', err);
      alert('初期登録処理中にエラーが発生しました。');
      return false;
    }
  };

  // Employee Profile Update Handler (Admin Only)
  const handleUpdateEmployee = async (updateData: {
    targetEmployeeId: string;
    newId: string;
    name: string;
    department: string;
    role: 'admin' | 'employee';
    password?: string;
    email?: string;
  }) => {
    if (!currentEmployee || currentEmployee.role !== 'admin') {
      alert('利用者の登録情報修正は管理者のみ実行できます。');
      return false;
    }

    try {
      const res = await fetch('/api/employees/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateData,
          modifiedById: currentEmployee.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '登録情報の更新に失敗しました。');
        return false;
      }

      if (data.employees) {
        setEmployees(data.employees);
        // If current logged-in employee was modified, update local currentEmployee
        if (data.employee && data.employee.id === (data.oldId || currentEmployee.id)) {
          setCurrentEmployee(data.employee);
          localStorage.setItem('hub_logged_in_employee_id', data.employee.id);
        }
      }

      fetchData();
      showToast('登録情報を正常に修正しました。', '更新完了', 'success');
      return true;
    } catch (err) {
      console.error('Failed to update employee info:', err);
      alert('登録情報修正処理中にエラーが発生しました。');
      return false;
    }
  };

  // Employee Deletion Handler (Admin Only)
  const handleDeleteEmployee = async (targetEmployeeId: string) => {
    if (!currentEmployee || currentEmployee.role !== 'admin') {
      alert('利用者の削除は管理者のみ実行できます。');
      return false;
    }

    try {
      const res = await fetch('/api/employees/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmployeeId,
          modifiedById: currentEmployee.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '削除に失敗しました。');
        return false;
      }

      if (data.employees) {
        setEmployees(data.employees);
        if (currentEmployee.id === targetEmployeeId && data.employees.length > 0) {
          setCurrentEmployee(data.employees[0]);
        }
      }

      setReservations((prev) => prev.filter((r) => r.employeeId !== targetEmployeeId));
      showToast('指定した利用者をシステムから削除しました。', '削除完了', 'success');
      return true;
    } catch (err) {
      console.error('Failed to delete employee:', err);
      alert('削除処理中にエラーが発生しました。');
      return false;
    }
  };

  // Lunch Menu Save Handler (Admin Only)
  const handleSaveLunchMenu = async (menuData: {
    id?: string;
    code: string;
    name: string;
    category: string;
    description?: string;
    price: number;
  }) => {
    if (!currentEmployee || currentEmployee.role !== 'admin') {
      alert('メニューの追加・編集は管理者のみ実行できます。');
      return false;
    }

    try {
      const res = await fetch('/api/lunch-menus/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...menuData,
          modifiedById: currentEmployee.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'メニューの保存に失敗しました。');
        return false;
      }

      if (data.lunchMenus) {
        setLunchMenus(data.lunchMenus);
      }
      showToast(`メニュー「[${menuData.code}] ${menuData.name}」を保存しました。`, 'メニュー更新', 'success');
      return true;
    } catch (err) {
      console.error('Failed to save lunch menu:', err);
      alert('メニューの保存中にエラーが発生しました。');
      return false;
    }
  };

  // Lunch Menu Delete Handler (Admin Only)
  const handleDeleteLunchMenu = async (id: string) => {
    if (!currentEmployee || currentEmployee.role !== 'admin') {
      alert('メニューの削除は管理者のみ実行できます。');
      return false;
    }

    try {
      const res = await fetch('/api/lunch-menus/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          modifiedById: currentEmployee.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'メニューの削除に失敗しました。');
        return false;
      }

      if (data.lunchMenus) {
        setLunchMenus(data.lunchMenus);
      }
      showToast('指定した弁当メニューを削除しました。', 'メニュー削除完了', 'info');
      return true;
    } catch (err) {
      console.error('Failed to delete lunch menu:', err);
      alert('メニューの削除中にエラーが発生しました。');
      return false;
    }
  };

  // Update handler
  const handleUpdateReservations = async (
    employeeId: string,
    updates: (Partial<Reservation> & { date: string })[],
    reason?: string
  ) => {
    if (!currentEmployee) return;

    try {
      const res = await fetch('/api/reservations/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          updates,
          modifiedById: currentEmployee.id,
          modifiedByName: `${currentEmployee.name} (${currentEmployee.role === 'admin' ? '管理者' : '一般社員'})`,
          reason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.updatedRecords && Array.isArray(data.updatedRecords)) {
          setReservations((prev) => {
            const copy = [...prev];
            data.updatedRecords.forEach((updated: Reservation) => {
              const idx = copy.findIndex((r) => r.employeeId === updated.employeeId && r.date === updated.date);
              if (idx !== -1) copy[idx] = updated;
              else copy.push(updated);
            });
            return copy;
          });
        }
        if (data.newLogs && Array.isArray(data.newLogs)) {
          setChangeLogs((prev) => [...data.newLogs, ...prev]);
        }
        showToast('予約内容を変更・履歴に記録して保存しました。', '更新完了', 'success');
      } else {
        alert(data.error || '予約の更新に失敗しました。');
      }
    } catch (err) {
      console.error('Failed to update reservations:', err);
      alert('予約の更新処理中にエラーが発生しました。');
    }
  };

  // Confirm month handler
  const handleConfirmMonth = async (employeeId: string, month: string, status: 'confirmed' | 'locked' = 'confirmed') => {
    if (!currentEmployee) return;

    try {
      const res = await fetch('/api/reservations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          month,
          status,
          modifiedById: currentEmployee.id,
          modifiedByName: `${currentEmployee.name} (${currentEmployee.role === 'admin' ? '管理者' : '一般社員'})`,
        }),
      });

      if (res.ok) {
        showToast(`${month}月分の予約を${status === 'locked' ? 'ロック' : '確定'}しました。`, '処理完了', 'success');
      }
    } catch (err) {
      console.error('Failed to confirm month:', err);
    }
  };

  // Trigger test push
  const handleTriggerTestNotification = async () => {
    try {
      await fetch('/api/notify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '【リマインド】翌日分の出勤・昼食予約確定のお願い',
          message: '明日（8月5日）の昼食発注締め切り（17:00）が近づいています。マイページより予約の確認・確定を行ってください。',
        }),
      });
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  };

  if (!currentEmployee) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center relative">
        <LoginModal employees={employees} onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-indigo-600 selection:text-white flex flex-col">
      {/* Header Bar */}
      <Navbar
        currentEmployee={currentEmployee}
        employees={employees}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'security') setIsSecurityModalOpen(true);
          else setActiveTab(tab);
        }}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onOpenCSVModal={() => setIsCSVModalOpen(true)}
        isRealtimeConnected={isRealtimeConnected}
        onRefreshData={fetchData}
        onLogout={handleLogout}
      />

      {/* Realtime Push Notification / Alert Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-md w-full animate-bounce">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-start space-x-3 ${
              toast.type === 'warning'
                ? 'bg-amber-950 text-amber-100 border-amber-700'
                : toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {toast.type === 'warning' ? (
              <Bell className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              {toast.title && <div className="font-bold text-xs uppercase tracking-wide opacity-90">{toast.title}</div>}
              <div className="text-xs font-medium leading-relaxed mt-0.5">{toast.message}</div>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Body Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'calendar' && (
          <UserReservationView
            currentEmployee={currentEmployee}
            employees={employees}
            reservations={reservations}
            lunchMenus={lunchMenus}
            onUpdateReservations={handleUpdateReservations}
            onConfirmMonth={handleConfirmMonth}
          />
        )}

        {activeTab === 'admin' && (
          <AdminMatrixView
            currentEmployee={currentEmployee}
            employees={employees}
            reservations={reservations}
            lunchMenus={lunchMenus}
            onUpdateReservations={handleUpdateReservations}
            onConfirmMonth={handleConfirmMonth}
            onOpenCSVModal={() => setIsCSVModalOpen(true)}
            onRegisterEmployee={handleRegisterEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onSaveLunchMenu={handleSaveLunchMenu}
            onDeleteLunchMenu={handleDeleteLunchMenu}
            onRefreshData={fetchData}
          />
        )}

        {activeTab === 'logs' && (
          <ChangeHistoryLogView changeLogs={changeLogs} lunchMenus={lunchMenus} currentEmployee={currentEmployee} />
        )}
      </main>

      {/* Modals */}
      <CSVExportModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        currentMonth={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        notificationSetting={notificationSetting}
        onTriggerTestNotification={handleTriggerTestNotification}
      />

      <RoleAccessModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />
    </div>
  );
}
