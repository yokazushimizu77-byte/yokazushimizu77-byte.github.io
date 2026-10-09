export type StandardAttendanceStatus = 'フル' | '午前' | '午後' | '休み';

export type AdminAttendanceStatus =
  | '当欠（身体）'
  | '当欠（精神）'
  | '当欠（私用）'
  | '加欠（身体）'
  | '加欠（精神）'
  | '無断'
  | 'フル（遅刻）'
  | 'フル（早退）'
  | '午前（遅刻）'
  | '午前（早退）'
  | '午後（遅刻）'
  | '午後（早退）';

export type AttendanceStatus = StandardAttendanceStatus | AdminAttendanceStatus;

export const STANDARD_ATTENDANCE_STATUSES: StandardAttendanceStatus[] = [
  'フル',
  '午前',
  '午後',
  '休み',
];

export const ALL_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'フル',
  'フル（遅刻）',
  'フル（早退）',
  '午前',
  '午前（遅刻）',
  '午前（早退）',
  '午後',
  '午後（遅刻）',
  '午後（早退）',
  '当欠（身体）',
  '当欠（精神）',
  '当欠（私用）',
  '加欠（身体）',
  '加欠（精神）',
  '無断',
  '休み',
];

export type LunchStatus = 'あり' | 'なし';

export type UserRole = 'employee' | 'admin';

export interface Employee {
  id: string;
  name: string;
  department: string;
  role: UserRole;
  avatarColor: string;
  email: string;
  password?: string;
}

export interface LunchMenu {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  price: number;
}

export type ReservationStatus = 'draft' | 'confirmed' | 'locked';

export interface Reservation {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  attendance: AttendanceStatus;
  lunchStatus: LunchStatus;
  lunchMenuId: string | null;
  status: ReservationStatus;
  note?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ChangeLog {
  id: string;
  reservationId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  modifiedBy: string;
  modifiedByName: string;
  timestamp: string;
  action: 'create' | 'update' | 'confirm' | 'cancel' | 'lock' | 'unlock' | 'delete';
  beforeState: {
    attendance?: AttendanceStatus;
    lunchStatus?: LunchStatus;
    lunchMenuId?: string | null;
    status?: ReservationStatus;
    note?: string;
  } | null;
  afterState: {
    attendance?: AttendanceStatus;
    lunchStatus?: LunchStatus;
    lunchMenuId?: string | null;
    status?: ReservationStatus;
    note?: string;
  } | null;
  reason?: string;
}

export interface NotificationSetting {
  enabled: boolean;
  dailyReminderTime: string; // e.g. "17:00"
  deadlineDaysNotice: number;
  lastNotifiedAt?: string;
}

export interface DaySummary {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  morningCount: number;
  afternoonCount: number;
  fullCount: number;
  offCount: number;
  totalWorking: number;
  lunchCount: number;
  lunchMenuBreakdown: Record<string, number>;
}
