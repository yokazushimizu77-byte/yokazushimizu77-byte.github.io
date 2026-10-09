import { Employee, LunchMenu, Reservation, ChangeLog } from '../types';

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'EMP001', name: '山田 太郎', department: '開発部', role: 'admin', avatarColor: 'bg-blue-600', email: 'yamada@example.com', password: '1234' },
  { id: 'EMP002', name: '佐藤 花子', department: '営業部', role: 'employee', avatarColor: 'bg-emerald-600', email: 'sato@example.com', password: '1234' },
  { id: 'EMP003', name: '鈴木 一郎', department: '総務部', role: 'employee', avatarColor: 'bg-purple-600', email: 'suzuki@example.com', password: '1234' },
  { id: 'EMP004', name: '高橋 美咲', department: '開発部', role: 'employee', avatarColor: 'bg-amber-600', email: 'takahashi@example.com', password: '1234' },
  { id: 'EMP005', name: '伊藤 健太', department: '営業部', role: 'employee', avatarColor: 'bg-rose-600', email: 'ito@example.com', password: '1234' },
  { id: 'EMP006', name: '渡辺 裕子', department: '企画部', role: 'admin', avatarColor: 'bg-indigo-600', email: 'watanabe@example.com', password: '1234' },
  { id: 'EMP007', name: '中村 拓海', department: '開発部', role: 'employee', avatarColor: 'bg-teal-600', email: 'nakamura@example.com', password: '1234' },
  { id: 'EMP008', name: '小林 誠', department: '企画部', role: 'employee', avatarColor: 'bg-orange-600', email: 'kobayashi@example.com', password: '1234' },
];

export const INITIAL_LUNCH_MENUS: LunchMenu[] = [
  { id: 'MENU_A', code: 'A', name: '日替わりA定食 (特製ハンバーグ 和風おろしソース)', category: '肉料理', description: 'ジューシーなハンバーグと新鮮地場野菜サラダセット', price: 650 },
  { id: 'MENU_B', code: 'B', name: '日替わりB定食 (鮮魚の西京焼き定食)', category: '魚料理', description: '脂ののった銀ヒラスの西京漬けと五穀米・味噌汁付き', price: 680 },
  { id: 'MENU_C', code: 'C', name: 'ヘルシーポキ丼 (マグロ & アボカド)', category: 'ヘルシー', description: '高たんぱく・低脂質のヘルシー海鮮丼', price: 700 },
  { id: 'MENU_D', code: 'D', name: '特製スパイスカレー (チキン & 彩り野菜)', category: 'カレー', description: '10種のスパイスを煮込んだ自家製欧風カレー', price: 600 },
  { id: 'MENU_E', code: 'E', name: '冷やしサラダうどん (ゴマだれ風味)', category: '麺類', description: '夏にぴったりのさっぱりモチモチ手打ち風うどん', price: 580 },
];

export function getFormattedMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getCurrentAndNextMonthStrings() {
  const now = new Date();
  const currentMonthStr = getFormattedMonthString(now);
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = getFormattedMonthString(nextMonthDate);
  return { currentMonthStr, nextMonthStr };
}

export function generateInitialReservations(): Reservation[] {
  const reservations: Reservation[] = [];
  const now = new Date();
  
  // Generate for current month and next month
  const months = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

  let idCounter = 1000;

  months.forEach((mDate) => {
    const year = mDate.getFullYear();
    const month = mDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dayOfWeek = d.getDay(); // 0 is Sun, 6 is Sat
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      INITIAL_EMPLOYEES.forEach((emp, empIdx) => {
        idCounter++;

        let attendance: 'フル' | '午前' | '午後' | '休み' = 'フル';
        let lunchStatus: 'あり' | 'なし' = 'あり';
        let lunchMenuId: string | null = INITIAL_LUNCH_MENUS[day % INITIAL_LUNCH_MENUS.length].id;
        let status: 'draft' | 'confirmed' | 'locked' = day <= 15 ? 'confirmed' : 'draft';

        // Weekend logic
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          attendance = '休み';
          lunchStatus = 'なし';
          lunchMenuId = null;
        } else {
          // Add realistic variation
          if ((day + empIdx) % 11 === 0) {
            attendance = '休み';
            lunchStatus = 'なし';
            lunchMenuId = null;
          } else if ((day + empIdx) % 7 === 0) {
            attendance = '午前';
            lunchStatus = 'あり';
            lunchMenuId = 'MENU_A';
          } else if ((day + empIdx) % 9 === 0) {
            attendance = '午後';
            lunchStatus = 'なし';
            lunchMenuId = null;
          } else {
            attendance = 'フル';
            lunchStatus = (day + empIdx) % 5 === 0 ? 'なし' : 'あり';
            if (lunchStatus === 'なし') lunchMenuId = null;
            else lunchMenuId = INITIAL_LUNCH_MENUS[(day + empIdx) % INITIAL_LUNCH_MENUS.length].id;
          }
        }

        reservations.push({
          id: `RES_${idCounter}`,
          employeeId: emp.id,
          date: dateStr,
          attendance,
          lunchStatus,
          lunchMenuId,
          status,
          updatedAt: new Date(Date.now() - (30 - day) * 3600000).toISOString(),
          updatedBy: emp.id,
        });
      });
    }
  });

  return reservations;
}

export const INITIAL_CHANGE_LOGS: ChangeLog[] = [
  {
    id: 'LOG_001',
    reservationId: 'RES_1020',
    employeeId: 'EMP002',
    employeeName: '佐藤 花子',
    date: new Date().toISOString().split('T')[0],
    modifiedBy: 'EMP002',
    modifiedByName: '佐藤 花子',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    action: 'update',
    beforeState: { attendance: 'フル', lunchStatus: 'あり', lunchMenuId: 'MENU_A' },
    afterState: { attendance: '午前', lunchStatus: 'なし', lunchMenuId: null },
    reason: '午後は直行営業のため直行直帰に変更',
  },
  {
    id: 'LOG_002',
    reservationId: 'RES_1045',
    employeeId: 'EMP004',
    employeeName: '高橋 美咲',
    date: new Date().toISOString().split('T')[0],
    modifiedBy: 'EMP001',
    modifiedByName: '山田 太郎 (管理者)',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    action: 'update',
    beforeState: { attendance: 'フル', lunchStatus: 'あり', lunchMenuId: 'MENU_B' },
    afterState: { attendance: '休み', lunchStatus: 'なし', lunchMenuId: null },
    reason: '体調不良による有給休暇の代行登録',
  },
  {
    id: 'LOG_003',
    reservationId: 'RES_1080',
    employeeId: 'EMP003',
    employeeName: '鈴木 一郎',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    modifiedBy: 'EMP003',
    modifiedByName: '鈴木 一郎',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    action: 'confirm',
    beforeState: { status: 'draft' },
    afterState: { status: 'confirmed' },
    reason: '当月予約確定登録',
  },
];
