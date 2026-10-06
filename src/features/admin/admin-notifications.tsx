"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Toast, type ToastTone } from "@mall/ui";

type Notice = { id: number; text: string; tone: ToastTone };
type Notifications = { notices: Notice[]; notify: (text: string, tone?: ToastTone) => void; dismiss: (id: number) => void };
const Context = createContext<Notifications | null>(null);

export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const notify = useCallback((text: string, tone: ToastTone = "success") => {
    if (!text.trim()) return;
    const notice = { id: ++nextId.current, text, tone };
    setNotices(current => [...current.slice(-2), notice]);
  }, []);
  const dismiss = useCallback((id: number) => setNotices(current => current.filter(notice => notice.id !== id)), []);
  return <Context.Provider value={{ notices, notify, dismiss }}>{children}</Context.Provider>;
}
export function useAdminNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error("AdminNotificationsProvider is required");
  return value;
}
const titles: Record<ToastTone, string> = { success: "Đã hoàn tất", info: "Thông tin", warning: "Cần kiểm tra", error: "Chưa thể hoàn tất" };
function AdminNotice({ notice }: { notice: Notice }) {
  const { dismiss } = useAdminNotifications();
  const close = useCallback(() => dismiss(notice.id), [dismiss, notice.id]);
  return <Toast tone={notice.tone} title={titles[notice.tone]} text={notice.text} onDismiss={close} closeLabel="Đóng thông báo" duration={notice.tone === "error" ? 12000 : 7000}/>;
}
export function AdminToastViewport() {
  const { notices } = useAdminNotifications();
  return <div className="admin-toast-viewport" role="region" aria-label="Thông báo hệ thống">{notices.map(notice => <AdminNotice key={notice.id} notice={notice}/>)}</div>;
}
