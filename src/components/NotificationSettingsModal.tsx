import React, { useState, useEffect } from 'react';
import { Bell, Clock, Send, ShieldCheck, CheckCircle, AlertCircle, X } from 'lucide-react';
import { NotificationSetting } from '../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificationSetting: NotificationSetting;
  onTriggerTestNotification: () => Promise<void>;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  notificationSetting,
  onTriggerTestNotification,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const [reminderTime, setReminderTime] = useState<string>(notificationSetting.dailyReminderTime || '17:00');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sentSuccessMsg, setSentSuccessMsg] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
    } else {
      alert('お使いのブラウザはWeb Notification APIに対応していません。');
    }
  };

  const handleSendTestPush = async () => {
    setIsSending(true);
    await onTriggerTestNotification();

    // Trigger local native browser notification if granted
    if (permission === 'granted' && typeof window !== 'undefined' && 'Notification' in window) {
      new Notification('【リマインド】出勤・昼食予約締め切りのお願い', {
        body: `翌日分の予約確定締め切り（${reminderTime}）が近づいています。予約表で出勤と昼食をご確認ください。`,
        icon: '/favicon.ico',
      });
    }

    setIsSending(false);
    setSentSuccessMsg(true);
    setTimeout(() => setSentSuccessMsg(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">プッシュ通知 ＆ 締め切りリマインド</h3>
            <p className="text-xs text-slate-500">予約の締め切り時間を自動リマインド通知</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Browser Notification Status */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">ブラウザ通知権限</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                ステータス: {' '}
                <span
                  className={`font-bold ${
                    permission === 'granted'
                      ? 'text-emerald-600'
                      : permission === 'denied'
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  }`}
                >
                  {permission === 'granted' ? '許可済み (Active)' : permission === 'denied' ? '拒否済み' : '未設定'}
                </span>
              </div>
            </div>

            {permission !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
              >
                通知を許可する
              </button>
            )}
          </div>

          {/* Schedule settings */}
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
            <div className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-indigo-600" />
              <span>自動リマインドスケジュール</span>
            </div>
            <p className="text-[11px] text-indigo-900/80 leading-relaxed">
              翌日分の出勤・昼食予約を未確定の社員に対して、毎日設定時刻にリマインド通知を自動配信します。
            </p>

            <div className="pt-2 flex items-center justify-between">
              <span className="font-semibold text-slate-700">毎日リマインド時刻:</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="p-1.5 border border-indigo-200 rounded-lg bg-white font-bold text-slate-800"
              />
            </div>
          </div>

          {/* Instant Test Push */}
          <div className="pt-2">
            <button
              onClick={handleSendTestPush}
              disabled={isSending}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all"
            >
              <Send className="h-4 w-4" />
              <span>{isSending ? '送信中...' : '今すぐリマインド通知をテスト実行'}</span>
            </button>

            {sentSuccessMsg && (
              <div className="mt-2 p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-center font-bold text-xs flex items-center justify-center gap-1">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>全端末にリアルタイムリマインド通知を送信しました！</span>
              </div>
            )}
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
