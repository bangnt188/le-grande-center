"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Alert, Button, ConfirmDialog, Modal } from "@mall/ui";
import type { AdminData } from "./use-admin-data";

/** One save/cancel/dirty boundary for admin record forms. */
export function AdminEditor({ data, title, description, children, onClose, onSave, saveLabel = "Lưu thay đổi" }: {
  data: AdminData; title: string; description: string; children: ReactNode;
  onClose: () => void; onSave: (values: FormData) => Promise<boolean>; saveLabel?: string;
}) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const saving = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [failed, setFailed] = useState(false);
  const { markDraft } = data;
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);
  useEffect(() => {
    markDraft(id, dirty);
    return () => markDraft(id, false);
  }, [id, dirty, markDraft]);
  function close() {
    if (saving.current || data.pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  return <div ref={host} className="admin-editor-host">
    <Modal open title={title} description={description} closeLabel="Đóng biểu mẫu" onOpenChange={open => { if (!open) close(); }} portalContainer={host} returnFocusRef={returnFocus}>
      <form className="admin-editor-form" onChange={() => { setDirty(true); setFailed(false); }} onSubmit={async event => {
        event.preventDefault();
        if (saving.current || data.pending) return;
        const values = new FormData(event.currentTarget);
        saving.current = true; setFailed(false);
        try {
          if (await onSave(values)) { markDraft(id, false); onClose(); }
          else setFailed(true);
        } finally { saving.current = false; }
      }}>
        <fieldset disabled={data.pending}>{children}</fieldset>
        {(failed || data.error) && <Alert tone="error">{data.error || "Chưa lưu được. Kiểm tra thông tin đã nhập và thử lại."}<Button variant="quiet" type="button" disabled={data.pending} onClick={() => void data.reload()}>Tải lại dữ liệu</Button></Alert>}
        <p className="draft-status" aria-live="polite">{dirty ? "Có thay đổi chưa lưu." : "Thay đổi chỉ được áp dụng sau khi lưu."}</p>
        <Button type="submit" loading={data.pending} loadingLabel="Đang lưu…" disabled={data.pending || data.loading}>{saveLabel}</Button>
      </form>
    </Modal>
    <ConfirmDialog open={discard} title="Bỏ thay đổi chưa lưu?" description="Thông tin đang sửa chưa được lưu. Bạn có thể quay lại để tiếp tục hoặc bỏ thay đổi." confirmLabel="Bỏ thay đổi" cancelLabel="Tiếp tục sửa" onClose={() => setDiscard(false)} onConfirm={() => { markDraft(id, false); onClose(); }} portalContainer={host}/>
  </div>;
}
