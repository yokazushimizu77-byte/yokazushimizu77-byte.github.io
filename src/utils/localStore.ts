import { Employee, LunchMenu, Reservation, ChangeLog, NotificationSetting } from '../types';
import defaultStoreData from '../../data_store.json';

const LOCAL_STORE_KEY = 'relife_hub_store_v1';

export interface LocalStoreData {
  employees: Employee[];
  lunchMenus: LunchMenu[];
  reservations: Reservation[];
  changeLogs: ChangeLog[];
  notificationSetting: NotificationSetting;
}

const toHalfWidth = (str: string): string => {
  if (!str) return '';
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
};

export const getLocalStore = (): LocalStoreData => {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
      // Ensure essential fields exist
      const store: LocalStoreData = {
        employees: Array.isArray(parsed.employees) ? parsed.employees : [...defaultStoreData.employees as Employee[]],
        lunchMenus: Array.isArray(parsed.lunchMenus) ? parsed.lunchMenus : [...defaultStoreData.lunchMenus as LunchMenu[]],
        reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [...defaultStoreData.reservations as Reservation[]],
        changeLogs: Array.isArray(parsed.changeLogs) ? parsed.changeLogs : [...defaultStoreData.changeLogs as ChangeLog[]],
        notificationSetting: parsed.notificationSetting || (defaultStoreData.notificationSetting as NotificationSetting),
      };

      // Ensure key accounts from defaultStoreData (such as Shimizu EMP011, Takeda EMP009, Yoshida EMP010) exist
      (defaultStoreData.employees as Employee[]).forEach((defaultEmp) => {
        const found = store.employees.find((e) => e.id === defaultEmp.id || (e.email && e.email.toLowerCase() === defaultEmp.email?.toLowerCase()));
        if (!found) {
          store.employees.push({ ...defaultEmp });
        } else if (defaultEmp.id === 'EMP011' && (!found.password || found.password === '1234')) {
          // Keep Shimizu's password synced if not updated
          found.password = defaultEmp.password || 'Relife0501';
          found.email = defaultEmp.email || 'yokazu.shimizu77@gmail.com';
        }
      });

      return store;
    }
  } catch (err) {
    console.warn('Failed to parse localStorage, resetting to default store:', err);
  }

  // First time or parsing failed: initialize with defaultStoreData
  const initialStore: LocalStoreData = {
    employees: JSON.parse(JSON.stringify(defaultStoreData.employees)),
    lunchMenus: JSON.parse(JSON.stringify(defaultStoreData.lunchMenus)),
    reservations: JSON.parse(JSON.stringify(defaultStoreData.reservations)),
    changeLogs: JSON.parse(JSON.stringify(defaultStoreData.changeLogs)),
    notificationSetting: JSON.parse(JSON.stringify(defaultStoreData.notificationSetting)),
  };

  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(initialStore));
  } catch (err) {
    console.warn('Failed to save initial store to localStorage:', err);
  }

  return initialStore;
};

export const saveLocalStore = (data: Partial<LocalStoreData>): LocalStoreData => {
  const current = getLocalStore();
  const updated: LocalStoreData = {
    ...current,
    ...data,
  };
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to persist to localStorage:', err);
  }
  return updated;
};

// Client-side authentication fallback
export const authenticateLocally = (
  emailOrId: string,
  pass: string
): { success: boolean; employee?: Employee; error?: string } => {
  const store = getLocalStore();
  const cleanInput = toHalfWidth(emailOrId.trim()).toLowerCase();

  const matched = store.employees.find((emp) => {
    const empEmail = emp.email ? toHalfWidth(emp.email.trim()).toLowerCase() : '';
    const empId = toHalfWidth(emp.id.trim()).toLowerCase();
    return empEmail === cleanInput || empId === cleanInput;
  });

  if (!matched) {
    return {
      success: false,
      error: '該当するメールアドレスまたは社員IDが見つかりません。',
    };
  }

  const expectedPass = matched.password || '1234';
  if (pass !== expectedPass) {
    return {
      success: false,
      error: 'パスワードが正しくありません。',
    };
  }

  return {
    success: true,
    employee: matched,
  };
};

// Client-side CSV Download
export const downloadCSVFile = (filename: string, csvContent: string) => {
  // UTF-8 with BOM for Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

export const generateAndDownloadCSV = (
  type: string,
  month: string,
  employees: Employee[],
  reservations: Reservation[],
  lunchMenus: LunchMenu[],
  changeLogs: ChangeLog[]
) => {
  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const getDayOfWeekStr = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : days[d.getDay()];
  };

  if (type === 'employees') {
    let csv = '社員ID,氏名,部署,権限,メールアドレス,パスワード\r\n';
    employees.forEach((emp) => {
      csv += [
        escapeCsv(emp.id),
        escapeCsv(emp.name),
        escapeCsv(emp.department),
        escapeCsv(emp.role === 'admin' ? '管理者' : '一般社員'),
        escapeCsv(emp.email || ''),
        escapeCsv(emp.password || '1234'),
      ].join(',') + '\r\n';
    });
    downloadCSVFile(`relife_staff_master_${new Date().toISOString().substring(0, 10)}.csv`, csv);
    return;
  }

  if (type === 'template_employees') {
    let csv = '社員ID,氏名,部署,権限,メールアドレス,パスワード\r\n';
    csv += 'EMP020,テスト 次郎,営業部,一般社員,jiro@example.com,1234\r\n';
    csv += 'EMP021,テスト 花子,福祉部,管理者,hanako@example.com,Relife2026\r\n';
    downloadCSVFile('template_employees.csv', csv);
    return;
  }

  if (type === 'template_reservations') {
    let csv = '日付,社員ID,出勤区分,昼食利用,メニュー記号\r\n';
    csv += '2026-10-01,EMP001,フル,あり,A\r\n';
    csv += '2026-10-01,EMP002,午前,なし,\r\n';
    csv += '2026-10-02,EMP001,休み,なし,\r\n';
    downloadCSVFile('template_reservations.csv', csv);
    return;
  }

  if (type === 'matrix') {
    let header = '日付,曜日';
    employees.forEach((emp) => {
      header += `,${escapeCsv(`${emp.name}(出勤)`)},${escapeCsv(`${emp.name}(昼食)`)}`;
    });
    header += '\r\n';

    let body = '';
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = getDayOfWeekStr(dateStr);
      let row = `${dateStr},${dayOfWeek}`;

      employees.forEach((emp) => {
        const res = reservations.find((r) => r.employeeId === emp.id && r.date === dateStr);
        const attendance = res ? res.attendance : '休み';
        let lunch = 'なし';
        if (res && res.lunchStatus === 'あり') {
          const menu = lunchMenus.find((menuItem) => menuItem.id === res.lunchMenuId);
          lunch = menu ? `[${menu.code}]` : 'あり';
        }
        row += `,${escapeCsv(attendance)},${escapeCsv(lunch)}`;
      });

      body += row + '\r\n';
    }

    downloadCSVFile(`relife_shift_matrix_${month}.csv`, header + body);
    return;
  }

  if (type === 'lunch_orders') {
    let header = '日付,曜日,合計食数';
    lunchMenus.forEach((menu) => {
      header += `,${escapeCsv(`[${menu.code}] ${menu.name}`)}`;
    });
    header += ',昼食なし/休み\r\n';

    let body = '';
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = getDayOfWeekStr(dateStr);
      const dayRes = reservations.filter((r) => r.date === dateStr);
      const totalOrders = dayRes.filter((r) => r.lunchStatus === 'あり').length;
      const noLunch = dayRes.filter((r) => r.lunchStatus === 'なし').length;

      let row = `${dateStr},${dayOfWeek},${totalOrders}`;
      lunchMenus.forEach((menu) => {
        const count = dayRes.filter((r) => r.lunchStatus === 'あり' && r.lunchMenuId === menu.id).length;
        row += `,${count}`;
      });
      row += `,${noLunch}\r\n`;
      body += row;
    }

    downloadCSVFile(`relife_lunch_orders_${month}.csv`, header + body);
    return;
  }

  if (type === 'logs') {
    let csv = '日時,操作者,対象日付,対象社員,操作種別,変更前,変更後,変更理由\r\n';
    changeLogs.forEach((log) => {
      const actionName =
        log.action === 'create' ? '新規' : log.action === 'confirm' ? '確定' : log.action === 'lock' ? 'ロック' : '更新';
      csv += [
        escapeCsv(log.timestamp),
        escapeCsv(log.modifiedByName || log.modifiedBy),
        escapeCsv(log.date || '-'),
        escapeCsv(log.employeeName || log.employeeId),
        escapeCsv(actionName),
        escapeCsv(JSON.stringify(log.beforeState || {})),
        escapeCsv(JSON.stringify(log.afterState || {})),
        escapeCsv(log.reason || ''),
      ].join(',') + '\r\n';
    });
    downloadCSVFile(`relife_audit_logs_${new Date().toISOString().substring(0, 10)}.csv`, csv);
    return;
  }
};

export const bulkImportEmployeesLocally = (
  validItems: Array<{ id: string; name: string; department: string; role: 'admin' | 'employee'; email?: string; password?: string }>,
  overwriteExisting: boolean
) => {
  const store = getLocalStore();
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  validItems.forEach((item) => {
    const existingIndex = store.employees.findIndex((e) => e.id === item.id);
    if (existingIndex !== -1) {
      if (overwriteExisting) {
        store.employees[existingIndex] = {
          ...store.employees[existingIndex],
          name: item.name,
          department: item.department,
          role: item.role,
          email: item.email || store.employees[existingIndex].email,
          password: item.password || store.employees[existingIndex].password || '1234',
        };
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      store.employees.push({
        id: item.id,
        name: item.name,
        department: item.department,
        role: item.role,
        avatarColor: 'bg-indigo-600',
        email: item.email,
        password: item.password || '1234',
      });
      addedCount++;
    }
  });

  saveLocalStore({ employees: store.employees });
  return { addedCount, updatedCount, skippedCount, employees: store.employees };
};

export const bulkImportReservationsLocally = (
  validItems: Array<{ date: string; employeeId: string; attendance: 'フル' | '午前' | '午後' | '休み'; lunchStatus: 'あり' | 'なし'; lunchMenuCode?: string }>
) => {
  const store = getLocalStore();
  let successCount = 0;
  let skippedCount = 0;

  validItems.forEach((item) => {
    const emp = store.employees.find((e) => e.id === item.employeeId);
    if (!emp) {
      skippedCount++;
      return;
    }

    let lunchMenuId: string | null = null;
    if (item.lunchStatus === 'あり') {
      if (item.lunchMenuCode) {
        const found = store.lunchMenus.find((m) => m.code.toUpperCase() === item.lunchMenuCode?.toUpperCase());
        lunchMenuId = found ? found.id : 'MENU_A';
      } else {
        lunchMenuId = 'MENU_A';
      }
    }

    const existingIdx = store.reservations.findIndex((r) => r.employeeId === item.employeeId && r.date === item.date);
    if (existingIdx !== -1) {
      store.reservations[existingIdx] = {
        ...store.reservations[existingIdx],
        attendance: item.attendance,
        lunchStatus: item.lunchStatus,
        lunchMenuId,
        updatedAt: new Date().toISOString(),
      };
    } else {
      store.reservations.push({
        id: `RES_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        employeeId: item.employeeId,
        date: item.date,
        attendance: item.attendance,
        lunchStatus: item.lunchStatus,
        lunchMenuId,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        updatedBy: item.employeeId,
      });
    }
    successCount++;
  });

  saveLocalStore({ reservations: store.reservations });
  return { successCount, skippedCount, reservations: store.reservations };
};
