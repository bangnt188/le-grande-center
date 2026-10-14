import { FLOORS, type Floor } from "./space-model";
export class AdminValidationError extends Error {}
export function text(value: string, limit: number, optional = false): string {
  if (typeof value !== "string" || value.length > limit) throw new Error(`Nội dung tối đa ${limit} ký tự.`);
  const result = value.trim(); if (!optional && !result) throw new Error("Nhập nội dung bắt buộc."); return result;
}
export function email(value: string, optional = false) { const result = text(value,254,optional); if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error("Địa chỉ email không hợp lệ."); return result; }
export function phone(value: string, optional = false) { const result = text(value,30,optional); if (result && (!/^\+?[\d\s().-]+$/.test(result) || !/^\d{7,15}$/.test(result.replace(/\D/g,"")))) throw new Error("Số điện thoại phải có 7–15 chữ số."); return result; }
export function integer(value: number, min: number, max: number) { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Nhập số nguyên từ ${min} đến ${max}.`); return value; }
export function floor(value: Floor) { if (!FLOORS.includes(value)) throw new Error("Chỉ có tầng 1 đến tầng 6."); return value; }
export function record<T extends {id:string}>(items:T[],id:string):T { const item=items.find(value=>value.id===id); if(!item) throw new AdminValidationError("Bản ghi không còn tồn tại. Tải lại dữ liệu."); return item; }
export function initials(value:string) { return value.split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase(); }
export function vietnamToday(now=Date.now()) { return new Date(now+7*3600000).toISOString().slice(0,10); }
export function dates(start:string,end:string) { for(const value of [start,end]) if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value) throw new Error("Chọn ngày thuê hợp lệ."); if(end<start||start<vietnamToday()) throw new Error("Ngày bắt đầu không trước hôm nay; ngày kết thúc không trước ngày bắt đầu."); }
