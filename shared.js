// shared.js — tiện ích chung cho App "Lịch phân xe ô tô dùng chung"
// Văn phòng Tỉnh uỷ Cao Bằng

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  initializeFirestore,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const auth = getAuth(app);

// ---------- Tên miền giả dùng cho tài khoản không theo định dạng email ----------
// Firebase Authentication (email/password) yêu cầu định dạng email ở backend,
// nhưng người dùng chỉ thấy/nhập "Tên đăng nhập" (chuỗi chữ+số, tối đa 10 ký tự).
// Ta gắn thêm một domain giả cố định để tạo thành email nội bộ cho Firebase Auth.
export const AUTH_EMAIL_DOMAIN = "lichphanxe.noreply.local";

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function emailToUsername(email) {
  return (email || "").split("@")[0];
}

// Tên đăng nhập hợp lệ: chỉ gồm chữ (không dấu) và số, độ dài 3-10 ký tự.
const USERNAME_RE = /^[a-zA-Z0-9]{3,10}$/;

export function isValidUsername(username) {
  return USERNAME_RE.test((username || "").trim());
}

// ---------- Ngày / tuần ----------
export const WEEKDAY_LABELS = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDMY(dateStr) {
  const d = fromDateStr(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = CN
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

export function getWeekId(date) {
  const monday = getMonday(date);
  const wk = getISOWeekNumber(monday);
  const yr = getISOWeekYear(monday);
  return `${yr}-W${pad2(wk)}`;
}

export function weekIdToMonday(weekId) {
  const [yearStr, wkStr] = weekId.split("-W");
  const year = Number(yearStr);
  const week = Number(wkStr);
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setUTCDate(simple.getUTCDate() - dow + 1);
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - dow);
  }
  return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
}

export function neighborWeekId(weekId, delta) {
  const monday = weekIdToMonday(weekId);
  monday.setDate(monday.getDate() + delta * 7);
  return getWeekId(monday);
}

// Mỗi ngày, mỗi xe có 2 ô nội dung: Sáng và Chiều — để lãnh đạo nhìn vào biết
// ngay buổi nào xe đang bận, buổi nào xe còn trống mà bố trí đi công tác.
export const SESSIONS = [
  { key: "morning", label: "Sáng" },
  { key: "afternoon", label: "Chiều" },
];

export function buildWeekDays(monday) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push({
      date: toDateStr(d),
      weekday: WEEKDAY_LABELS[i],
      sessions: { morning: "", afternoon: "" },
    });
  }
  return days;
}
