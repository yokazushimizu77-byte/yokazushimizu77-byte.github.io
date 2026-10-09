import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_EMPLOYEES,
  INITIAL_LUNCH_MENUS,
  generateInitialReservations,
  INITIAL_CHANGE_LOGS,
} from './src/data/initialData.js';
import {
  Reservation,
  ChangeLog,
  NotificationSetting,
  Employee,
  AttendanceStatus,
  LunchMenu,
} from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent File Database Path
const DB_FILE = path.join(process.cwd(), 'data_store.json');

// In-Memory Database State
let employees = [...INITIAL_EMPLOYEES];
let lunchMenus = [...INITIAL_LUNCH_MENUS];
let reservations: Reservation[] = generateInitialReservations();
let changeLogs: ChangeLog[] = [...INITIAL_CHANGE_LOGS];
let notificationSetting: NotificationSetting = {
  enabled: true,
  dailyReminderTime: '17:00',
  deadlineDaysNotice: 1,
  lastNotifiedAt: undefined,
};

function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.employees)) employees = data.employees;
      if (Array.isArray(data.lunchMenus)) lunchMenus = data.lunchMenus;
      if (Array.isArray(data.reservations)) reservations = data.reservations;
      if (Array.isArray(data.changeLogs)) changeLogs = data.changeLogs;
      if (data.notificationSetting) notificationSetting = data.notificationSetting;
      console.log(`Loaded persisted data from ${DB_FILE}`);
      return;
    }
  } catch (err) {
    console.error('Error loading data_store.json:', err);
  }
  saveData();
}

function saveData() {
  try {
    const data = {
      employees,
      lunchMenus,
      reservations,
      changeLogs,
      notificationSetting,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data_store.json:', err);
  }
}

// Load persisted data at startup
loadData();

// SSE Connected Clients List for Real-time Updates
const sseClients: { id: string; res: Response }[] = [];

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    client.res.write(payload);
  });
}

// SSE Stream Endpoint
app.get('/api/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  sseClients.push({ id: clientId, res });

  // Send immediate welcome ping
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

function toHalfWidth(str: string): string {
  if (!str) return '';
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
}

// API Routes

// 0. Employee Login Endpoint
app.post('/api/login', (req: Request, res: Response) => {
  const { email, id, password } = req.body;

  const loginInput = email || id;
  if (!loginInput || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください。' });
  }

  const cleanInput = toHalfWidth(String(loginInput).trim()).toLowerCase();
  const emp = employees.find(
    (e) =>
      (e.email && e.email.trim().toLowerCase() === cleanInput) ||
      toHalfWidth(e.id).trim().toLowerCase() === cleanInput
  );
  if (!emp) {
    return res.status(401).json({ error: '該当するメールアドレスが存在しません。' });
  }

  const expectedPass = emp.password || '1234';
  if (password !== expectedPass) {
    return res.status(401).json({ error: 'パスワードが正しくありません。' });
  }

  res.json({ success: true, employee: emp });
});

// 1. Initial Data Fetch
app.get('/api/initial-data', (req: Request, res: Response) => {
  res.json({
    employees,
    lunchMenus,
    reservations,
    changeLogs,
    notificationSetting,
  });
});

// 2. Reservation Upsert / Update
app.post('/api/reservations/update', (req: Request, res: Response) => {
  const { employeeId, updates, modifiedById, modifiedByName, reason } = req.body;

  if (!employeeId || !Array.isArray(updates)) {
    return res.status(400).json({ error: '無効なパラメータです' });
  }

  const targetEmp = employees.find((e) => e.id === employeeId);
  const modifier = employees.find((e) => e.id === modifiedById) || targetEmp;

  // Authorization Check: Non-admins cannot update other employees' reservations!
  if (modifier && modifier.role !== 'admin' && modifier.id !== employeeId) {
    return res.status(403).json({ error: '他の利用者のシフトや予約を変更する権限がありません。' });
  }

  const updatedRecords: Reservation[] = [];
  const newLogs: ChangeLog[] = [];

  updates.forEach((up: Partial<Reservation> & { date: string }) => {
    let existingIdx = reservations.findIndex(
      (r) => r.employeeId === employeeId && r.date === up.date
    );

    const nowIso = new Date().toISOString();

    if (existingIdx !== -1) {
      const existing = reservations[existingIdx];

      // Prevent editing if confirmed/locked unless forced by admin
      if (existing.status === 'locked' && modifier?.role !== 'admin') {
        return; // skip locked
      }

      // Check if anything changed (or if reason is provided for proxy edit/cancel)
      const attChanged = up.attendance && up.attendance !== existing.attendance;
      const lunchStatusChanged = up.lunchStatus && up.lunchStatus !== existing.lunchStatus;
      const menuChanged = up.lunchMenuId !== undefined && up.lunchMenuId !== existing.lunchMenuId;
      const statusChanged = up.status && up.status !== existing.status;

      if (attChanged || lunchStatusChanged || menuChanged || statusChanged || Boolean(reason)) {
        const beforeState = {
          attendance: existing.attendance,
          lunchStatus: existing.lunchStatus,
          lunchMenuId: existing.lunchMenuId,
          status: existing.status,
          note: existing.note,
        };

        const afterState = {
          attendance: up.attendance ?? existing.attendance,
          lunchStatus: up.lunchStatus ?? existing.lunchStatus,
          lunchMenuId: up.lunchMenuId !== undefined ? up.lunchMenuId : existing.lunchMenuId,
          status: up.status ?? existing.status,
          note: up.note ?? existing.note,
        };

        const updatedRes: Reservation = {
          ...existing,
          ...afterState,
          updatedAt: nowIso,
          updatedBy: modifiedById || employeeId,
        };

        reservations[existingIdx] = updatedRes;
        updatedRecords.push(updatedRes);

        const log: ChangeLog = {
          id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          reservationId: existing.id,
          employeeId,
          employeeName: targetEmp?.name || employeeId,
          date: up.date,
          modifiedBy: modifiedById || employeeId,
          modifiedByName: modifiedByName || targetEmp?.name || employeeId,
          timestamp: nowIso,
          action: 'update',
          beforeState,
          afterState,
          reason: reason || (modifier?.role === 'admin' ? '管理者による直接変更' : '本人による予約更新'),
        };

        newLogs.push(log);
        changeLogs.unshift(log);
      }
    } else {
      // Create new reservation
      const newRes: Reservation = {
        id: `RES_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        employeeId,
        date: up.date,
        attendance: up.attendance || 'フル',
        lunchStatus: up.lunchStatus || 'あり',
        lunchMenuId: up.lunchMenuId !== undefined ? up.lunchMenuId : 'MENU_A',
        status: up.status || 'draft',
        note: up.note,
        updatedAt: nowIso,
        updatedBy: modifiedById || employeeId,
      };

      reservations.push(newRes);
      updatedRecords.push(newRes);

      const log: ChangeLog = {
        id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        reservationId: newRes.id,
        employeeId,
        employeeName: targetEmp?.name || employeeId,
        date: up.date,
        modifiedBy: modifiedById || employeeId,
        modifiedByName: modifiedByName || targetEmp?.name || employeeId,
        timestamp: nowIso,
        action: 'create',
        beforeState: null,
        afterState: {
          attendance: newRes.attendance,
          lunchStatus: newRes.lunchStatus,
          lunchMenuId: newRes.lunchMenuId,
          status: newRes.status,
        },
        reason: reason || '新規予約登録',
      };

      newLogs.push(log);
      changeLogs.unshift(log);
    }
  });

  // Broadcast change via SSE
  broadcastSSE('reservation-updated', {
    updatedRecords,
    newLogs,
    employeeId,
    modifiedByName,
  });

  saveData();

  res.json({ success: true, updatedRecords, newLogs });
});

// 3. Batch Confirmation / Locking
app.post('/api/reservations/confirm', (req: Request, res: Response) => {
  const { employeeId, month, status, modifiedById, modifiedByName } = req.body;

  const targetEmp = employees.find((e) => e.id === employeeId);
  const nowIso = new Date().toISOString();
  let updatedCount = 0;

  reservations = reservations.map((r) => {
    if ((!employeeId || r.employeeId === employeeId) && r.date.startsWith(month)) {
      updatedCount++;
      return {
        ...r,
        status: status || 'confirmed',
        updatedAt: nowIso,
        updatedBy: modifiedById,
      };
    }
    return r;
  });

  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'BATCH',
    employeeId: employeeId || 'ALL',
    employeeName: targetEmp?.name || '全社員',
    date: month,
    modifiedBy: modifiedById,
    modifiedByName,
    timestamp: nowIso,
    action: status === 'locked' ? 'lock' : 'confirm',
    beforeState: { status: 'draft' },
    afterState: { status: status || 'confirmed' },
    reason: `${month}の予約を${status === 'locked' ? 'ロック' : '確定'}処理しました`,
  };

  changeLogs.unshift(log);

  broadcastSSE('batch-confirmed', {
    employeeId,
    month,
    status: status || 'confirmed',
    modifiedByName,
    log,
  });

  saveData();

  res.json({ success: true, updatedCount, log });
});

// 4. Change History Logs
app.get('/api/history', (req: Request, res: Response) => {
  const { employeeId, action } = req.query;

  let filtered = [...changeLogs];
  if (employeeId) {
    filtered = filtered.filter((l) => l.employeeId === employeeId);
  }
  if (action) {
    filtered = filtered.filter((l) => l.action === action);
  }

  res.json({ logs: filtered });
});

// 5. CSV Export Endpoint
app.get('/api/export/csv', (req: Request, res: Response) => {
  const { month, type } = req.query; // type: 'matrix' | 'lunch_orders' | 'logs' | 'employees' | 'template_employees' | 'template_reservations'
  const targetMonth = (month as string) || new Date().toISOString().substring(0, 7);

  // UTF-8 BOM for Excel Japanese compatibility
  const bom = '\uFEFF';
  let csvContent = '';
  let filename = `attendance_reservation_${targetMonth}_${type || 'matrix'}.csv`;

  if (type === 'employees') {
    filename = `employees_master_${new Date().toISOString().substring(0, 10)}.csv`;
    csvContent = '社員ID,氏名,部署,権限,メールアドレス,パスワード\n';
    employees.forEach((emp) => {
      const roleStr = emp.role === 'admin' ? '管理者' : '一般社員';
      csvContent += `"${emp.id}","${emp.name}","${emp.department}","${roleStr}","${emp.email || ''}","${emp.password || '1234'}"\n`;
    });
  } else if (type === 'template_employees') {
    filename = `template_employees_import.csv`;
    csvContent = '社員ID,氏名,部署,権限,メールアドレス,パスワード\n';
    csvContent += '"EMP009","武田 信玄","営業部","一般社員","takeda@example.com","1234"\n';
    csvContent += '"EMP010","吉田 健一","開発部","管理者","yoshida@example.com","1234"\n';
    csvContent += '"EMP011","佐藤 智子","総務部","一般社員","satot@example.com","1234"\n';
  } else if (type === 'template_reservations') {
    filename = `template_reservations_import.csv`;
    const todayStr = new Date().toISOString().substring(0, 10);
    csvContent = '日付,社員ID,出勤区分,昼食あり/なし,注文メニューコード\n';
    csvContent += `"${todayStr}","EMP001","フル","あり","A"\n`;
    csvContent += `"${todayStr}","EMP002","午前","なし",""\n`;
  } else if (type === 'logs') {
    csvContent = '日時,対象社員ID,対象社員名,変更日,操作種別,変更前,変更後,変更者,変更理由\n';
    changeLogs.forEach((l) => {
      const beforeStr = l.beforeState ? `${l.beforeState.attendance || ''} / 昼食:${l.beforeState.lunchStatus || ''}` : 'なし';
      const afterStr = l.afterState ? `${l.afterState.attendance || ''} / 昼食:${l.afterState.lunchStatus || ''}` : 'なし';
      csvContent += `"${l.timestamp}","${l.employeeId}","${l.employeeName}","${l.date}","${l.action}","${beforeStr}","${afterStr}","${l.modifiedByName}","${l.reason || ''}"\n`;
    });
  } else if (type === 'lunch_orders') {
    csvContent = '日付,社員ID,社員名,部署,出勤区分,昼食あり/なし,注文メニューコード,注文メニュー名\n';
    const monthRes = reservations.filter((r) => r.date.startsWith(targetMonth));
    monthRes.sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));

    monthRes.forEach((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      const menu = lunchMenus.find((m) => m.id === r.lunchMenuId);
      csvContent += `"${r.date}","${r.employeeId}","${emp?.name || ''}","${emp?.department || ''}","${r.attendance}","${r.lunchStatus}","${menu?.code || ''}","${menu?.name || ''}"\n`;
    });
  } else {
    // Default Matrix Export
    const monthRes = reservations.filter((r) => r.date.startsWith(targetMonth));

    // Get all unique dates in the month sorted
    const dates = Array.from(new Set(monthRes.map((r) => r.date))).sort();

    // Header: Employee ID, Employee Name, Department, Date 1 Attendance, Date 1 Lunch, Date 2...
    let header = '社員ID,社員名,部署';
    dates.forEach((d) => {
      header += `,"${d} (出勤)","${d} (昼食)"`;
    });
    csvContent += header + '\n';

    employees.forEach((emp) => {
      let row = `"${emp.id}","${emp.name}","${emp.department}"`;
      dates.forEach((d) => {
        const r = monthRes.find((res) => res.employeeId === emp.id && res.date === d);
        if (r) {
          const menu = lunchMenus.find((m) => m.id === r.lunchMenuId);
          const lunchStr = r.lunchStatus === 'あり' ? `あり (${menu?.code || '未選択'})` : 'なし';
          row += `,"${r.attendance}","${lunchStr}"`;
        } else {
          row += `,"-","-"`;
        }
      });
      csvContent += row + '\n';
    });
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(bom + csvContent);
});

// 5.5 Bulk Import Employees (Admin Only)
app.post('/api/employees/bulk-import', (req: Request, res: Response) => {
  const { employeesData, overwriteExisting, modifiedById } = req.body;

  const modifier = employees.find((e) => e.id === modifiedById);
  if (!modifier || modifier.role !== 'admin') {
    return res.status(403).json({ error: '職員の一括データ登録は管理者のみ実行できます。' });
  }

  if (!Array.isArray(employeesData) || employeesData.length === 0) {
    return res.status(400).json({ error: '登録データが空です。' });
  }

  const colors = [
    'bg-indigo-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-purple-600',
    'bg-cyan-600',
    'bg-teal-600',
    'bg-blue-600',
  ];

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const newEmployeesList: Employee[] = [];

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthObj.getFullYear()}-${String(nextMonthObj.getMonth() + 1).padStart(2, '0')}`;
  const months = [currentMonthStr, nextMonthStr];
  const nowIso = now.toISOString();

  for (const item of employeesData) {
    const rawId = item.id || item['社員ID'] || item['ID'];
    const rawName = item.name || item['氏名'] || item['名前'];
    const rawDept = item.department || item['部署'] || '一般';
    const rawRole = item.role || item['権限'] || 'employee';
    const rawEmail = item.email || item['メールアドレス'] || item['メール'];
    const rawPassword = item.password || item['パスワード'] || '1234';

    if (!rawId || !rawName) {
      skippedCount++;
      continue;
    }

    const cleanId = toHalfWidth(String(rawId).trim()).toUpperCase();
    const cleanName = String(rawName).trim();
    const cleanDept = String(rawDept).trim() || '一般';
    const isRoleAdmin =
      String(rawRole).trim().toLowerCase() === 'admin' ||
      String(rawRole).trim().includes('管理');
    const finalRole: 'admin' | 'employee' = isRoleAdmin ? 'admin' : 'employee';
    const cleanEmail = rawEmail ? String(rawEmail).trim().toLowerCase() : `${cleanId.toLowerCase()}@example.com`;
    const cleanPass = rawPassword ? String(rawPassword).trim() : '1234';

    const existingIdx = employees.findIndex(
      (e) => toHalfWidth(e.id).trim().toUpperCase() === cleanId
    );

    if (existingIdx !== -1) {
      if (overwriteExisting) {
        employees[existingIdx] = {
          ...employees[existingIdx],
          name: cleanName,
          department: cleanDept,
          role: finalRole,
          email: cleanEmail,
          password: cleanPass,
        };
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      const avatarColor = colors[(employees.length + newEmployeesList.length) % colors.length];
      const newEmp: Employee = {
        id: cleanId,
        name: cleanName,
        department: cleanDept,
        role: finalRole,
        avatarColor,
        email: cleanEmail,
        password: cleanPass,
      };
      employees.push(newEmp);
      newEmployeesList.push(newEmp);
      addedCount++;

      // Create default reservations for weekdays
      months.forEach((m) => {
        const [year, month] = m.split('-').map(Number);
        const daysCount = new Date(year, month, 0).getDate();
        for (let day = 1; day <= daysCount; day++) {
          const dayStr = String(day).padStart(2, '0');
          const dateStr = `${m}-${dayStr}`;
          const dayOfWeek = new Date(year, month - 1, day).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          if (!isWeekend) {
            reservations.push({
              id: `RES_${newEmp.id}_${dateStr}`,
              employeeId: newEmp.id,
              date: dateStr,
              attendance: 'フル',
              lunchStatus: 'あり',
              lunchMenuId: null,
              status: 'draft',
              updatedAt: nowIso,
              updatedBy: modifier.id,
            });
          }
        }
      });
    }
  }

  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'EMP_BULK',
    employeeId: modifier.id,
    employeeName: modifier.name,
    date: currentMonthStr,
    modifiedBy: modifier.id,
    modifiedByName: `${modifier.name} (管理者)`,
    timestamp: nowIso,
    action: 'create',
    beforeState: null,
    afterState: null,
    reason: `管理者による職員マスター一括データ登録（新規: ${addedCount}件, 更新: ${updatedCount}件, スキップ: ${skippedCount}件）`,
  };

  changeLogs.unshift(log);

  broadcastSSE('employees-bulk-updated', {
    addedCount,
    updatedCount,
    skippedCount,
    employees,
    log,
    modifiedByName: modifier.name,
  });

  saveData();

  res.json({
    success: true,
    addedCount,
    updatedCount,
    skippedCount,
    totalProcessed: employeesData.length,
    employees,
  });
});

// 5.6 Bulk Import Shifts / Reservations (Admin Only)
app.post('/api/reservations/bulk-import', (req: Request, res: Response) => {
  const { reservationsData, modifiedById } = req.body;

  const modifier = employees.find((e) => e.id === modifiedById);
  if (!modifier || modifier.role !== 'admin') {
    return res.status(403).json({ error: '出勤・シフトの一括登録は管理者のみ実行できます。' });
  }

  if (!Array.isArray(reservationsData) || reservationsData.length === 0) {
    return res.status(400).json({ error: '予約データが空です。' });
  }

  let successCount = 0;
  let skippedCount = 0;
  const nowIso = new Date().toISOString();

  for (const item of reservationsData) {
    const rawDate = item.date || item['日付'];
    const rawEmpId = item.employeeId || item['社員ID'] || item['ID'];
    const rawAttendance = item.attendance || item['出勤区分'] || item['区分'] || 'フル';
    const rawLunchStatus = item.lunchStatus || item['昼食'] || item['昼食あり/なし'] || 'あり';
    const rawMenuCode = item.lunchMenuCode || item['メニューコード'] || item['注文メニューコード'];

    if (!rawDate || !rawEmpId) {
      skippedCount++;
      continue;
    }

    const cleanDate = String(rawDate).trim();
    const cleanEmpId = toHalfWidth(String(rawEmpId).trim()).toUpperCase();

    // Check employee existence
    const empExists = employees.some((e) => toHalfWidth(e.id).trim().toUpperCase() === cleanEmpId);
    if (!empExists) {
      skippedCount++;
      continue;
    }

    // Map lunch menu
    let menuId: string | null = null;
    if (rawMenuCode) {
      const codeClean = toHalfWidth(String(rawMenuCode).trim()).toUpperCase();
      const menu = lunchMenus.find((m) => m.code === codeClean);
      if (menu) menuId = menu.id;
    }

    const finalLunchStatus: 'あり' | 'なし' =
      String(rawLunchStatus).includes('あり') || String(rawLunchStatus).toLowerCase() === 'yes' ? 'あり' : 'なし';

    const existingResIdx = reservations.findIndex(
      (r) => r.employeeId === cleanEmpId && r.date === cleanDate
    );

    if (existingResIdx !== -1) {
      reservations[existingResIdx] = {
        ...reservations[existingResIdx],
        attendance: rawAttendance as AttendanceStatus,
        lunchStatus: finalLunchStatus,
        lunchMenuId: finalLunchStatus === 'あり' ? menuId : null,
        updatedAt: nowIso,
        updatedBy: modifier.id,
      };
    } else {
      reservations.push({
        id: `RES_${cleanEmpId}_${cleanDate}`,
        employeeId: cleanEmpId,
        date: cleanDate,
        attendance: rawAttendance as AttendanceStatus,
        lunchStatus: finalLunchStatus,
        lunchMenuId: finalLunchStatus === 'あり' ? menuId : null,
        status: 'draft',
        updatedAt: nowIso,
        updatedBy: modifier.id,
      });
    }
    successCount++;
  }

  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'RES_BULK',
    employeeId: modifier.id,
    employeeName: modifier.name,
    date: new Date().toISOString().substring(0, 7),
    modifiedBy: modifier.id,
    modifiedByName: `${modifier.name} (管理者)`,
    timestamp: nowIso,
    action: 'update',
    beforeState: null,
    afterState: null,
    reason: `管理者による出勤・シフトデータ一括インポート（処理件数: ${successCount}件, スキップ: ${skippedCount}件）`,
  };

  changeLogs.unshift(log);

  broadcastSSE('reservations-bulk-updated', {
    successCount,
    reservations,
    log,
    modifiedByName: modifier.name,
  });

  saveData();

  res.json({
    success: true,
    successCount,
    skippedCount,
    reservations,
  });
});

// 6. Test Push Notification Trigger Endpoint
app.post('/api/notify/test', (req: Request, res: Response) => {
  const { title, message } = req.body;
  const payload = {
    title: title || '【リマインド】昼食・出勤予約の締め切り通知',
    message: message || '翌日分の予約確定締め切り時刻（17:00）が近づいています。確認と確定を行ってください。',
    timestamp: new Date().toISOString(),
  };

  notificationSetting.lastNotifiedAt = payload.timestamp;

  broadcastSSE('push-notification', payload);
  res.json({ success: true, payload });
});

// 7. Initial Registration of Employee (Admin Only)
app.post('/api/employees/register', (req: Request, res: Response) => {
  const { id, name, department, role, modifiedById } = req.body;

  const modifier = employees.find((e) => e.id === modifiedById);
  if (!modifier || modifier.role !== 'admin') {
    return res.status(403).json({ error: '初期登録（名前やID）は管理者のみ実行できます。' });
  }

  if (!id || !name || !department) {
    return res.status(400).json({ error: '社員ID、氏名、部署は必須入力項目です。' });
  }

  const normalizedId = toHalfWidth(String(id).trim());

  const existing = employees.find((e) => toHalfWidth(e.id).trim().toLowerCase() === normalizedId.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `社員ID「${normalizedId}」は既に登録されています。` });
  }

  const colors = [
    'bg-indigo-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-purple-600',
    'bg-cyan-600',
    'bg-teal-600',
    'bg-blue-600',
  ];
  const avatarColor = colors[employees.length % colors.length];

  const newEmployee = {
    id: normalizedId,
    name: name.trim(),
    department: department.trim(),
    role: (role === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee',
    avatarColor,
    email: `${normalizedId.toLowerCase()}@company.co.jp`,
  };

  employees.push(newEmployee);

  // Auto-generate default reservations for current & next month
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthObj.getFullYear()}-${String(nextMonthObj.getMonth() + 1).padStart(2, '0')}`;

  const months = [currentMonthStr, nextMonthStr];
  const nowIso = new Date().toISOString();

  months.forEach((m) => {
    const [year, month] = m.split('-').map(Number);
    const daysCount = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysCount; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${m}-${dayStr}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend) {
        reservations.push({
          id: `RES_${newEmployee.id}_${dateStr}`,
          employeeId: newEmployee.id,
          date: dateStr,
          attendance: 'フル',
          lunchStatus: 'あり',
          lunchMenuId: null,
          status: 'draft',
          updatedAt: nowIso,
          updatedBy: modifier.id,
        });
      }
    }
  });

  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'EMP_REG',
    employeeId: newEmployee.id,
    employeeName: newEmployee.name,
    date: currentMonthStr,
    modifiedBy: modifier.id,
    modifiedByName: `${modifier.name} (管理者)`,
    timestamp: nowIso,
    action: 'create',
    beforeState: null,
    afterState: null,
    reason: `管理者による社員初期登録: ${newEmployee.name} (${newEmployee.id})`,
  };

  changeLogs.unshift(log);

  broadcastSSE('employee-added', {
    newEmployee,
    addedByName: modifier.name,
    employees,
    log,
  });

  saveData();

  res.json({ success: true, employee: newEmployee, employees });
});

// 7.5 Update Employee Info (Admin Only)
app.post('/api/employees/update', (req: Request, res: Response) => {
  const { targetEmployeeId, newId, name, department, role, password, email, modifiedById } = req.body;

  const modifier = employees.find((e) => e.id === modifiedById);
  if (!modifier || modifier.role !== 'admin') {
    return res.status(403).json({ error: '利用者の登録情報修正は管理者のみ実行できます。' });
  }

  if (!targetEmployeeId) {
    return res.status(400).json({ error: '対象の社員IDが指定されていません。' });
  }

  const empIndex = employees.findIndex((e) => e.id === targetEmployeeId);
  if (empIndex === -1) {
    return res.status(404).json({ error: '指定された社員が見つかりませんでした。' });
  }

  const existingEmp = employees[empIndex];
  const formattedNewId = newId ? toHalfWidth(String(newId).trim()) : existingEmp.id;

  // If ID is changing, check for conflicts with other employees
  if (formattedNewId !== existingEmp.id) {
    const conflict = employees.find(
      (e) => toHalfWidth(e.id).trim().toLowerCase() === formattedNewId.toLowerCase() && e.id !== existingEmp.id
    );
    if (conflict) {
      return res.status(400).json({ error: `変更後の社員ID「${formattedNewId}」は既に別の社員に使用されています。` });
    }
  }

  // Prevent demoting the last remaining admin
  const adminCount = employees.filter((e) => e.role === 'admin').length;
  const isTargetAdmin = existingEmp.role === 'admin';
  const isDemoting = isTargetAdmin && role === 'employee';
  if (isDemoting && adminCount <= 1) {
    return res.status(400).json({ error: 'システムに最低1名の管理者が存在する必要があるため、一般社員へ変更できません。' });
  }

  const oldId = existingEmp.id;
  const updatedEmp = {
    ...existingEmp,
    id: formattedNewId,
    name: name ? name.trim() : existingEmp.name,
    department: department ? department.trim() : existingEmp.department,
    role: (role === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee',
    password: password !== undefined ? password.trim() : (existingEmp.password || '1234'),
    email: email ? email.trim() : existingEmp.email || `${formattedNewId.toLowerCase()}@company.co.jp`,
  };

  employees[empIndex] = updatedEmp;

  // If ID changed, cascade update reservations & changeLogs
  if (formattedNewId !== oldId) {
    reservations.forEach((r) => {
      if (r.employeeId === oldId) {
        r.employeeId = formattedNewId;
        r.id = r.id.replace(`RES_${oldId}_`, `RES_${formattedNewId}_`);
      }
    });

    changeLogs.forEach((l) => {
      if (l.employeeId === oldId) {
        l.employeeId = formattedNewId;
      }
      if (l.modifiedBy === oldId) {
        l.modifiedBy = formattedNewId;
      }
    });
  }

  const nowIso = new Date().toISOString();
  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'EMP_UPD',
    employeeId: updatedEmp.id,
    employeeName: updatedEmp.name,
    date: new Date().toISOString().substring(0, 7),
    modifiedBy: modifier.id,
    modifiedByName: `${modifier.name} (管理者)`,
    timestamp: nowIso,
    action: 'update',
    beforeState: null,
    afterState: null,
    reason: `管理者による利用者の登録情報修正 (ID: ${oldId} -> ${updatedEmp.id}, 権限: ${updatedEmp.role})`,
  };

  changeLogs.unshift(log);

  broadcastSSE('employee-updated', {
    oldId,
    updatedEmployee: updatedEmp,
    modifiedByName: modifier.name,
    employees,
    log,
  });

  saveData();

  res.json({ success: true, employee: updatedEmp, employees });
});

// 8. Delete Employee (Admin Only)
app.post('/api/employees/delete', (req: Request, res: Response) => {
  const { targetEmployeeId, modifiedById } = req.body;

  const modifier = employees.find((e) => e.id === modifiedById);
  if (!modifier || modifier.role !== 'admin') {
    return res.status(403).json({ error: '利用者の削除は管理者のみ実行できます。' });
  }

  if (!targetEmployeeId) {
    return res.status(400).json({ error: '削除対象の社員IDが指定されていません。' });
  }

  const empIndex = employees.findIndex((e) => e.id === targetEmployeeId);
  if (empIndex === -1) {
    return res.status(404).json({ error: '指定された社員が見つかりませんでした。' });
  }

  const deletedEmp = employees[empIndex];

  // Prevent deleting the last remaining admin
  const adminCount = employees.filter((e) => e.role === 'admin').length;
  if (deletedEmp.role === 'admin' && adminCount <= 1) {
    return res.status(400).json({ error: 'システムに最低1名の管理者が存在する必要があるため、削除できません。' });
  }

  // Remove employee
  employees.splice(empIndex, 1);

  // Remove associated reservations
  reservations = reservations.filter((r) => r.employeeId !== targetEmployeeId);

  const nowIso = new Date().toISOString();
  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'EMP_DEL',
    employeeId: targetEmployeeId,
    employeeName: deletedEmp.name,
    date: new Date().toISOString().substring(0, 7),
    modifiedBy: modifier.id,
    modifiedByName: `${modifier.name} (管理者)`,
    timestamp: nowIso,
    action: 'delete',
    beforeState: null,
    afterState: null,
    reason: `管理者による利用者の削除: ${deletedEmp.name} (${deletedEmp.id})`,
  };

  changeLogs.unshift(log);

  broadcastSSE('employee-deleted', {
    deletedEmployeeId: targetEmployeeId,
    deletedEmpName: deletedEmp.name,
    deletedByName: modifier.name,
    employees,
    log,
  });

  saveData();

  res.json({ success: true, deletedEmployeeId: targetEmployeeId, employees });
});

// 9. Save / Add / Edit Lunch Menu (Admin Only)
app.post('/api/lunch-menus/save', (req: Request, res: Response) => {
  const { id, code, name, category, description, price, modifiedById } = req.body;

  const modifier = employees.find((e) => e.id === modifiedById);
  if (!modifier || modifier.role !== 'admin') {
    return res.status(403).json({ error: 'メニューの追加・編集は管理者のみ実行できます。' });
  }

  if (!code || !name) {
    return res.status(400).json({ error: 'メニューコードとメニュー名は必須入力項目です。' });
  }

  const cleanCode = toHalfWidth(String(code).trim()).toUpperCase();
  const parsedPrice = Number(price) || 0;

  let targetMenu: LunchMenu;
  if (id) {
    // Edit existing menu
    const menuIdx = lunchMenus.findIndex((m) => m.id === id);
    if (menuIdx !== -1) {
      lunchMenus[menuIdx] = {
        ...lunchMenus[menuIdx],
        code: cleanCode,
        name: String(name).trim(),
        category: category ? String(category).trim() : 'その他',
        description: description ? String(description).trim() : '',
        price: parsedPrice,
      };
      targetMenu = lunchMenus[menuIdx];
    } else {
      return res.status(404).json({ error: '指定されたメニューが見つかりませんでした。' });
    }
  } else {
    // Check if code already exists
    if (lunchMenus.some((m) => m.code === cleanCode)) {
      return res.status(400).json({ error: `メニューコード「${cleanCode}」は既に登録されています。` });
    }

    const newMenuId = `MENU_${cleanCode}_${Date.now()}`;
    targetMenu = {
      id: newMenuId,
      code: cleanCode,
      name: String(name).trim(),
      category: category ? String(category).trim() : 'その他',
      description: description ? String(description).trim() : '',
      price: parsedPrice,
    };
    lunchMenus.push(targetMenu);
  }

  const nowIso = new Date().toISOString();
  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'MENU_UPDATE',
    employeeId: modifier.id,
    employeeName: modifier.name,
    date: new Date().toISOString().substring(0, 7),
    modifiedBy: modifier.id,
    modifiedByName: `${modifier.name} (管理者)`,
    timestamp: nowIso,
    action: 'update',
    beforeState: null,
    afterState: null,
    reason: `管理者による弁当メニューの保存・更新: [${targetMenu.code}] ${targetMenu.name}`,
  };
  changeLogs.unshift(log);

  broadcastSSE('lunch-menus-updated', {
    lunchMenus,
    log,
    modifiedByName: modifier.name,
  });

  saveData();

  res.json({ success: true, lunchMenus, menu: targetMenu });
});

// 10. Delete Lunch Menu (Admin Only)
app.post('/api/lunch-menus/delete', (req: Request, res: Response) => {
  const { id, modifiedById } = req.body;

  const modifier = employees.find((e) => e.id === modifiedById);
  if (!modifier || modifier.role !== 'admin') {
    return res.status(403).json({ error: 'メニューの削除は管理者のみ実行できます。' });
  }

  if (lunchMenus.length <= 1) {
    return res.status(400).json({ error: '最低1つのメニューを残す必要があります。' });
  }

  const targetIdx = lunchMenus.findIndex((m) => m.id === id);
  if (targetIdx === -1) {
    return res.status(404).json({ error: '対象のメニューが見つかりませんでした。' });
  }

  const deleted = lunchMenus[targetIdx];
  lunchMenus.splice(targetIdx, 1);

  const nowIso = new Date().toISOString();
  const log: ChangeLog = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reservationId: 'MENU_DELETE',
    employeeId: modifier.id,
    employeeName: modifier.name,
    date: new Date().toISOString().substring(0, 7),
    modifiedBy: modifier.id,
    modifiedByName: `${modifier.name} (管理者)`,
    timestamp: nowIso,
    action: 'delete',
    beforeState: null,
    afterState: null,
    reason: `管理者による弁当メニューの削除: [${deleted.code}] ${deleted.name}`,
  };
  changeLogs.unshift(log);

  broadcastSSE('lunch-menus-updated', {
    lunchMenus,
    log,
    modifiedByName: modifier.name,
  });

  saveData();

  res.json({ success: true, lunchMenus });
});

// Vite Middleware & Static Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
