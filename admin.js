// ============================================================================
// admin.js — Logic cho trang nhập liệu (admin.html) — Lịch phân xe ô tô dùng chung
// ============================================================================

import {
  initializeApp,
  deleteApp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  db,
  auth,
  usernameToEmail,
  isValidUsername,
  getWeekId,
  formatDMY,
  weekIdToMonday,
  toDateStr,
  WEEKDAY_LABELS,
  buildWeekDays,
  SESSIONS,
} from "./shared.js";
import { DEFAULT_CARS, firebaseConfig } from "./firebase-config.js";

const els = {
  loginView: document.getElementById("loginView"),
  editorView: document.getElementById("editorView"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  loginBtn: document.getElementById("loginBtn"),
  loginStatus: document.getElementById("loginStatus"),
  whoName: document.getElementById("whoName"),
  whoRoleBadge: document.getElementById("whoRoleBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  saveStatus: document.getElementById("saveStatus"),
  weekRangeText: document.getElementById("weekRangeText"),
  prevBtn: document.getElementById("prevWeekBtn"),
  nextBtn: document.getElementById("nextWeekBtn"),
  thisBtn: document.getElementById("thisWeekBtn"),
  copyPrevBtn: document.getElementById("copyPrevBtn"),

  togglePasswordBtn: document.getElementById("togglePasswordBtn"),
  passwordPanel: document.getElementById("passwordPanel"),
  passwordStatus: document.getElementById("passwordStatus"),
  oldPassword: document.getElementById("oldPassword"),
  newPassword: document.getElementById("newPassword"),
  newPassword2: document.getElementById("newPassword2"),
  changePasswordBtn: document.getElementById("changePasswordBtn"),

  toggleCarsBtn: document.getElementById("toggleCarsBtn"),
  carsPanel: document.getElementById("carsPanel"),
  carsForm: document.getElementById("carsForm"),
  addCarRowBtn: document.getElementById("addCarRowBtn"),
  saveCarsBtn: document.getElementById("saveCarsBtn"),

  toggleImportBtn: document.getElementById("toggleImportBtn"),
  importPanel: document.getElementById("importPanel"),
  importFile: document.getElementById("importFile"),
  importParseBtn: document.getElementById("importParseBtn"),
  importStatus: document.getElementById("importStatus"),
  importPreview: document.getElementById("importPreview"),
  importApplyBtn: document.getElementById("importApplyBtn"),

  daysEditor: document.getElementById("daysEditor"),
  saveWeekBtn: document.getElementById("saveWeekBtn"),

  toggleAccountsBtn: document.getElementById("toggleAccountsBtn"),
  accountsPanel: document.getElementById("accountsPanel"),
  accountsStatus: document.getElementById("accountsStatus"),
  accountsList: document.getElementById("accountsList"),
  newAccDisplayName: document.getElementById("newAccDisplayName"),
  newAccUsername: document.getElementById("newAccUsername"),
  newAccRole: document.getElementById("newAccRole"),
  newAccCarRow: document.getElementById("newAccCarRow"),
  newAccCar: document.getElementById("newAccCar"),
  newAccPassword: document.getElementById("newAccPassword"),
  addAccountBtn: document.getElementById("addAccountBtn"),
};

let cars = DEFAULT_CARS;
let currentWeekId = getWeekId(new Date());
let currentWeekData = {}; // carId -> { carId, days: [...] }
let currentAccount = null; // { uid, username, displayName, role, carId, disabled }

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function banner(el, msg, type) {
  if (!msg) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="status-banner ${type}">${escapeHtml(msg)}</div>`;
}

function isManager() {
  return currentAccount && currentAccount.role === "manager";
}

// ---------------- Đăng nhập / đăng xuất ----------------

els.loginBtn.addEventListener("click", async () => {
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  if (!isValidUsername(username)) {
    banner(els.loginStatus, "Tên đăng nhập phải là chữ và số, độ dài 3-10 ký tự.", "error");
    return;
  }
  if (!password) {
    banner(els.loginStatus, "Vui lòng nhập mật khẩu.", "error");
    return;
  }
  els.loginBtn.disabled = true;
  banner(els.loginStatus, "Đang đăng nhập…", "info");
  try {
    await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
  } catch (e) {
    banner(els.loginStatus, "Đăng nhập thất bại: tên đăng nhập hoặc mật khẩu không đúng.", "error");
  } finally {
    els.loginBtn.disabled = false;
  }
});

els.logoutBtn.addEventListener("click", () => signOut(auth));

async function loadCurrentAccount(user) {
  try {
    const snap = await getDoc(doc(db, "accounts", user.uid));
    if (!snap.exists() || snap.data().disabled === true) {
      banner(
        els.loginStatus,
        "Tài khoản của bạn chưa được cấp quyền hoặc đã bị khoá. Vui lòng liên hệ cán bộ quản lý.",
        "error"
      );
      currentAccount = null;
      return false;
    }
    const data = snap.data();
    currentAccount = {
      uid: user.uid,
      username: data.username || "",
      displayName: data.displayName || data.username || "",
      role: data.role === "manager" ? "manager" : "driver",
      carId: data.carId || null,
    };
    return true;
  } catch (e) {
    console.error(e);
    banner(els.loginStatus, "Lỗi khi kiểm tra quyền tài khoản: " + e.message, "error");
    currentAccount = null;
    return false;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const ok = await loadCurrentAccount(user);
    if (!ok) {
      await signOut(auth);
      return;
    }
    els.loginView.style.display = "none";
    els.editorView.style.display = "";
    els.whoName.textContent = currentAccount.displayName;
    renderWhoRoleBadge();
    applyRoleVisibility();
    await loadCars();
    await loadWeek(currentWeekId);
  } else {
    els.loginView.style.display = "";
    els.editorView.style.display = "none";
    currentAccount = null;
  }
});

function renderWhoRoleBadge() {
  const cls = currentAccount.role === "manager" ? "role-badge superadmin" : "role-badge driver-badge";
  const text = currentAccount.role === "manager" ? "Cán bộ quản lý" : "Lái xe";
  els.whoRoleBadge.innerHTML = `<span class="${cls}">${text}</span>`;
}

function applyRoleVisibility() {
  els.toggleCarsBtn.style.display = isManager() ? "" : "none";
  els.toggleAccountsBtn.style.display = isManager() ? "" : "none";
  els.toggleImportBtn.style.display = isManager() ? "" : "none";
  els.carsPanel.style.display = "none";
  els.accountsPanel.style.display = "none";
  els.passwordPanel.style.display = "none";
  els.importPanel.style.display = "none";
}

// ---------------- Đổi mật khẩu của tôi (mọi vai trò) ----------------

els.togglePasswordBtn.addEventListener("click", () => {
  const show = els.passwordPanel.style.display === "none";
  els.passwordPanel.style.display = show ? "" : "none";
  els.togglePasswordBtn.textContent = show ? "Đổi mật khẩu của tôi ▴" : "Đổi mật khẩu của tôi ▾";
});

els.changePasswordBtn.addEventListener("click", async () => {
  const oldPw = els.oldPassword.value;
  const newPw = els.newPassword.value;
  const newPw2 = els.newPassword2.value;
  if (!oldPw || !newPw) {
    banner(els.passwordStatus, "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.", "error");
    return;
  }
  if (newPw.length < 6) {
    banner(els.passwordStatus, "Mật khẩu mới phải có ít nhất 6 ký tự.", "error");
    return;
  }
  if (newPw !== newPw2) {
    banner(els.passwordStatus, "Hai lần nhập mật khẩu mới không khớp.", "error");
    return;
  }
  els.changePasswordBtn.disabled = true;
  banner(els.passwordStatus, "Đang cập nhật mật khẩu…", "info");
  try {
    const user = auth.currentUser;
    const cred = EmailAuthProvider.credential(user.email, oldPw);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPw);
    els.oldPassword.value = "";
    els.newPassword.value = "";
    els.newPassword2.value = "";
    banner(els.passwordStatus, "Đã đổi mật khẩu thành công.", "success");
  } catch (e) {
    console.error(e);
    banner(els.passwordStatus, "Đổi mật khẩu thất bại: mật khẩu hiện tại không đúng, hoặc mật khẩu mới quá yếu.", "error");
  } finally {
    els.changePasswordBtn.disabled = false;
  }
});

// ---------------- Danh sách xe ----------------

async function loadCars() {
  try {
    const snap = await getDoc(doc(db, "settings", "cars"));
    if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length) {
      cars = snap.data().list;
    }
  } catch (e) {
    console.warn(e);
  }
}

function renderCarsForm() {
  els.carsForm.innerHTML = cars.map((c, i) => `
    <div class="car-form-row">
      <input type="text" data-idx="${i}" data-field="bienSo" value="${escapeHtml(c.bienSo)}" placeholder="Biển số" />
      <input type="text" data-idx="${i}" data-field="taiXe" value="${escapeHtml(c.taiXe)}" placeholder="Tài xế" />
      <input type="text" data-idx="${i}" data-field="dienThoai" value="${escapeHtml(c.dienThoai || "")}" placeholder="Điện thoại" />
      <button class="btn ghost" data-remove-idx="${i}">Xoá</button>
    </div>
  `).join("");

  els.carsForm.querySelectorAll("button[data-remove-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cars.splice(Number(btn.dataset.removeIdx), 1);
      renderCarsForm();
    });
  });
}

els.toggleCarsBtn.addEventListener("click", () => {
  const show = els.carsPanel.style.display === "none";
  els.carsPanel.style.display = show ? "" : "none";
  els.toggleCarsBtn.textContent = show ? "Sửa danh sách xe ▴" : "Sửa danh sách xe ▾";
  if (show) renderCarsForm();
});

els.addCarRowBtn.addEventListener("click", () => {
  const inputs = els.carsForm.querySelectorAll("input");
  const updated = cars.map((c) => ({ ...c }));
  inputs.forEach((inp) => {
    const idx = Number(inp.dataset.idx);
    updated[idx][inp.dataset.field] = inp.value.trim();
  });
  cars = updated;
  cars.push({ id: "car" + Date.now(), bienSo: "", taiXe: "", dienThoai: "" });
  renderCarsForm();
});

els.saveCarsBtn.addEventListener("click", async () => {
  const inputs = els.carsForm.querySelectorAll("input");
  const updated = cars.map((c) => ({ ...c }));
  inputs.forEach((inp) => {
    const idx = Number(inp.dataset.idx);
    updated[idx][inp.dataset.field] = inp.value.trim();
  });
  cars = updated;
  try {
    await setDoc(doc(db, "settings", "cars"), { list: cars });
    banner(els.saveStatus, "Đã lưu danh sách xe.", "success");
    renderDaysEditor();
  } catch (e) {
    console.error(e);
    banner(els.saveStatus, "Lỗi khi lưu danh sách xe: " + e.message, "error");
  }
});

// ---------------- Quản lý tài khoản đăng nhập ----------------

els.toggleAccountsBtn.addEventListener("click", () => {
  const show = els.accountsPanel.style.display === "none";
  els.accountsPanel.style.display = show ? "" : "none";
  els.toggleAccountsBtn.textContent = show ? "Quản lý tài khoản đăng nhập ▴" : "Quản lý tài khoản đăng nhập ▾";
  if (show) {
    populateNewAccCarSelect();
    loadAccountsList();
  }
});

els.newAccRole.addEventListener("change", () => {
  els.newAccCarRow.style.display = els.newAccRole.value === "driver" ? "" : "none";
});

function populateNewAccCarSelect() {
  els.newAccCar.innerHTML = cars.map((c) => `<option value="${c.id}">${escapeHtml(c.bienSo)} (${escapeHtml(c.taiXe)})</option>`).join("");
  els.newAccCarRow.style.display = els.newAccRole.value === "driver" ? "" : "none";
}

function carLabel(carId) {
  const c = cars.find((x) => x.id === carId);
  return c ? `${c.bienSo} (${c.taiXe})` : "(không rõ)";
}

function roleLabel(role) {
  return role === "manager" ? "Cán bộ quản lý" : "Lái xe";
}

async function loadAccountsList() {
  if (!currentAccount) return;
  try {
    const snap = await getDocs(collection(db, "accounts"));
    const accounts = [];
    snap.forEach((d) => accounts.push({ uid: d.id, ...d.data() }));
    accounts.sort((a, b) => {
      if (a.role !== b.role) return a.role === "manager" ? -1 : 1;
      return (a.displayName || "").localeCompare(b.displayName || "", "vi");
    });
    renderAccountsList(accounts);
  } catch (e) {
    console.error(e);
    banner(els.accountsStatus, "Không tải được danh sách tài khoản: " + e.message, "error");
  }
}

function renderAccountsList(accounts) {
  const canManage = isManager();
  els.accountsList.innerHTML = accounts.map((a) => `
    <div class="account-row ${a.disabled ? "disabled" : ""}">
      <div class="account-info">
        <div class="account-name">${escapeHtml(a.displayName || "(Chưa cập nhật)")} <span class="role-badge ${a.role === "manager" ? "superadmin" : "driver-badge"}">${roleLabel(a.role)}</span>${a.disabled ? ' <span class="role-badge disabled-badge">Đã khoá</span>' : ""}</div>
        <div class="account-meta">Tên đăng nhập: ${escapeHtml(a.username || "")}${a.role === "driver" ? " — " + escapeHtml(carLabel(a.carId)) : ""}</div>
      </div>
      ${canManage && a.uid !== currentAccount.uid ? `
        <button class="btn ${a.disabled ? "" : "ghost"}" data-uid="${a.uid}" data-action="${a.disabled ? "enable" : "disable"}">
          ${a.disabled ? "Mở khoá" : "Khoá"}
        </button>` : ""}
    </div>
  `).join("") || '<p class="hint">Chưa có tài khoản nào.</p>';

  els.accountsList.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => onToggleAccountDisabled(btn.dataset.uid, btn.dataset.action === "disable"));
  });
}

async function onToggleAccountDisabled(uid, disable) {
  const msg = disable
    ? "Khoá tài khoản này? Người này sẽ không thể đăng nhập/cập nhật lịch phân xe nữa."
    : "Mở khoá tài khoản này?";
  if (!confirm(msg)) return;
  try {
    await updateDoc(doc(db, "accounts", uid), { disabled: disable });
    banner(els.accountsStatus, disable ? "Đã khoá tài khoản." : "Đã mở khoá tài khoản.", "success");
    await loadAccountsList();
  } catch (e) {
    console.error(e);
    banner(els.accountsStatus, "Lỗi: " + e.message, "error");
  }
}

els.addAccountBtn.addEventListener("click", async () => {
  const displayName = els.newAccDisplayName.value.trim();
  const username = els.newAccUsername.value.trim();
  const role = els.newAccRole.value;
  const carId = role === "driver" ? els.newAccCar.value : null;
  const password = els.newAccPassword.value;

  if (!displayName) {
    banner(els.accountsStatus, "Vui lòng nhập Họ và tên.", "error");
    return;
  }
  if (!isValidUsername(username)) {
    banner(els.accountsStatus, "Tên đăng nhập phải là chữ và số, độ dài 3-10 ký tự.", "error");
    return;
  }
  if (!password || password.length < 6) {
    banner(els.accountsStatus, "Mật khẩu phải có ít nhất 6 ký tự.", "error");
    return;
  }
  if (role === "driver" && !carId) {
    banner(els.accountsStatus, "Vui lòng chọn xe phụ trách cho lái xe.", "error");
    return;
  }

  els.addAccountBtn.disabled = true;
  banner(els.accountsStatus, "Đang tạo tài khoản…", "info");

  const secondaryApp = initializeApp(firebaseConfig, "Secondary-" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const email = usernameToEmail(username);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    await setDoc(doc(db, "accounts", uid), {
      username,
      displayName,
      role,
      carId: role === "driver" ? carId : null,
      disabled: false,
      createdAt: serverTimestamp(),
      createdBy: currentAccount.username,
    });
    banner(els.accountsStatus, `Đã tạo tài khoản cho ${displayName} (${username}).`, "success");
    els.newAccDisplayName.value = "";
    els.newAccUsername.value = "";
    els.newAccPassword.value = "";
    await loadAccountsList();
  } catch (e) {
    console.error(e);
    let msg = "Lỗi khi tạo tài khoản: " + e.message;
    if (e.code === "auth/email-already-in-use") msg = "Tên đăng nhập này đã có tài khoản, vui lòng chọn tên khác.";
    if (e.code === "auth/weak-password") msg = "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
    banner(els.accountsStatus, msg, "error");
  } finally {
    try { await deleteApp(secondaryApp); } catch (_) {}
    els.addAccountBtn.disabled = false;
  }
});

// ---------------- Tải / điều hướng tuần ----------------

function visibleCars() {
  if (isManager()) return cars;
  return cars.filter((c) => c.id === currentAccount.carId);
}

async function loadWeek(weekId) {
  currentWeekId = weekId;
  const monday = weekIdToMonday(weekId);
  const wk = weekId.split("-W")[1];
  els.weekRangeText.textContent = `Tuần ${wk} — từ ${formatDMY(toDateStr(monday))}`;
  banner(els.saveStatus, "Đang tải dữ liệu tuần…", "info");
  try {
    currentWeekData = await fetchWeekData(weekId, monday);
    banner(els.saveStatus, "");
    renderDaysEditor();
  } catch (e) {
    console.error(e);
    banner(els.saveStatus, "Không tải được dữ liệu tuần: " + e.message, "error");
  }
}

// Tương thích ngược với dữ liệu cũ (nếu có) chỉ có trường `text` cho mỗi ngày,
// thay vì `sessions.morning` / `sessions.afternoon`.
function normalizeSessions(day) {
  if (day && day.sessions && typeof day.sessions === "object") {
    return {
      morning: day.sessions.morning || "",
      afternoon: day.sessions.afternoon || "",
    };
  }
  if (day && typeof day.text === "string" && day.text) {
    return { morning: day.text, afternoon: "" };
  }
  return { morning: "", afternoon: "" };
}

async function fetchWeekData(weekId, monday) {
  const result = {};
  const snap = await getDocs(collection(db, "weeks", weekId, "cars"));
  const existing = {};
  snap.forEach((d) => (existing[d.id] = d.data()));
  cars.forEach((c) => {
    const ex = existing[c.id];
    if (ex && Array.isArray(ex.days)) {
      result[c.id] = {
        carId: c.id,
        days: ex.days.map((day, i) => ({
          date: day.date,
          weekday: day.weekday || WEEKDAY_LABELS[i],
          sessions: normalizeSessions(day),
        })),
      };
    } else {
      result[c.id] = { carId: c.id, days: buildWeekDays(monday) };
    }
  });
  return result;
}

els.prevBtn.addEventListener("click", () => {
  const monday = weekIdToMonday(currentWeekId);
  monday.setDate(monday.getDate() - 7);
  loadWeek(getWeekId(monday));
});

els.nextBtn.addEventListener("click", () => {
  const monday = weekIdToMonday(currentWeekId);
  monday.setDate(monday.getDate() + 7);
  loadWeek(getWeekId(monday));
});

els.thisBtn.addEventListener("click", () => loadWeek(getWeekId(new Date())));

els.copyPrevBtn.addEventListener("click", async () => {
  if (!confirm("Sao chép toàn bộ nội dung của tuần trước vào tuần hiện tại? Nội dung hiện tại (chưa lưu) sẽ bị thay thế.")) return;
  const monday = weekIdToMonday(currentWeekId);
  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevWeekId = getWeekId(prevMonday);
  try {
    const prevData = await fetchWeekData(prevWeekId, prevMonday);
    const dateStrs = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dateStrs.push(toDateStr(d));
    }
    visibleCars().forEach((c) => {
      const prevDays = (prevData[c.id] && prevData[c.id].days) || [];
      currentWeekData[c.id] = {
        carId: c.id,
        days: dateStrs.map((dateStr, i) => {
          const prevDay = prevDays[i];
          const prevSessions = prevDay ? normalizeSessions(prevDay) : { morning: "", afternoon: "" };
          return { date: dateStr, weekday: WEEKDAY_LABELS[i], sessions: { ...prevSessions } };
        }),
      };
    });
    renderDaysEditor();
    banner(els.saveStatus, "Đã sao chép nội dung từ tuần trước. Nhớ bấm Lưu để áp dụng.", "success");
  } catch (e) {
    console.error(e);
    banner(els.saveStatus, "Lỗi khi sao chép: " + e.message, "error");
  }
});

// ---------------- Soạn / lưu lịch tuần ----------------

function renderDaysEditor() {
  const monday = weekIdToMonday(currentWeekId);
  const vCars = visibleCars();
  const dateStrs = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dateStrs.push(toDateStr(d));
  }

  els.daysEditor.innerHTML = dateStrs.map((dateStr, dayIdx) => {
    const blocks = vCars.map((c) => {
      const entry = ensureDayEntry(c.id, dateStr, dayIdx, monday);
      const fields = SESSIONS.map((s) => `
        <div class="session-field">
          <label>${s.label}</label>
          <textarea data-day="${dayIdx}" data-car="${c.id}" data-session="${s.key}" placeholder="Giờ và nội dung công việc buổi ${s.label.toLowerCase()}…">${escapeHtml(entry.sessions?.[s.key] || "")}</textarea>
        </div>`).join("");
      return `
        <div class="car-edit-block${currentAccount.role === "driver" ? " my-car" : ""}">
          <div class="car-title">${escapeHtml(c.bienSo)} (${escapeHtml(c.taiXe)})</div>
          <div class="session-pair">${fields}</div>
        </div>`;
    }).join("");

    return `
      <div class="day-editor-card">
        <div class="day-editor-head">
          <span>${WEEKDAY_LABELS[dayIdx]}</span>
          <span>${formatDMY(dateStr)}</span>
        </div>
        ${blocks}
      </div>`;
  }).join("");
}

function ensureDayEntry(carId, dateStr, dayIdx, monday) {
  if (!currentWeekData[carId]) {
    currentWeekData[carId] = { carId, days: buildWeekDays(monday) };
  }
  let entry = currentWeekData[carId].days.find((d) => d.date === dateStr);
  if (!entry) {
    entry = { date: dateStr, weekday: WEEKDAY_LABELS[dayIdx], sessions: { morning: "", afternoon: "" } };
    currentWeekData[carId].days.push(entry);
  }
  if (!entry.sessions) entry.sessions = normalizeSessions(entry);
  return entry;
}

function collectWeekDataFromForm() {
  els.daysEditor.querySelectorAll("textarea").forEach((ta) => {
    const dayIdx = Number(ta.dataset.day);
    const carId = ta.dataset.car;
    const sessionKey = ta.dataset.session;
    const day = currentWeekData[carId] && currentWeekData[carId].days[dayIdx];
    if (day) {
      if (!day.sessions) day.sessions = { morning: "", afternoon: "" };
      day.sessions[sessionKey] = ta.value;
    }
  });
}

els.saveWeekBtn.addEventListener("click", async () => {
  collectWeekDataFromForm();
  els.saveWeekBtn.disabled = true;
  banner(els.saveStatus, "Đang lưu…", "info");
  try {
    if (isManager()) {
      const batch = writeBatch(db);
      cars.forEach((c) => {
        const data = currentWeekData[c.id] || { carId: c.id, days: buildWeekDays(weekIdToMonday(currentWeekId)) };
        data.updatedAt = serverTimestamp();
        data.updatedBy = currentAccount.username;
        batch.set(doc(db, "weeks", currentWeekId, "cars", c.id), data);
      });
      await batch.commit();
    } else {
      const c = cars.find((x) => x.id === currentAccount.carId);
      if (!c) throw new Error("Không tìm thấy xe phụ trách của bạn.");
      const data = currentWeekData[c.id] || { carId: c.id, days: buildWeekDays(weekIdToMonday(currentWeekId)) };
      data.updatedAt = serverTimestamp();
      data.updatedBy = currentAccount.username;
      await setDoc(doc(db, "weeks", currentWeekId, "cars", c.id), data);
    }
    banner(els.saveStatus, "Đã lưu lịch phân xe tuần này thành công — đã hiển thị trực tiếp cho mọi người.", "success");
  } catch (e) {
    console.error(e);
    banner(els.saveStatus, "Lỗi khi lưu dữ liệu: " + e.message, "error");
  } finally {
    els.saveWeekBtn.disabled = false;
  }
});

// ============================================================================
// ---------------- Nhập dữ liệu tự động từ file Thông báo (Word/PDF) --------
// ============================================================================
// Chỉ Cán bộ quản lý mới thấy mục này (ẩn/hiện qua applyRoleVisibility()).
// Luồng xử lý: đọc file -> dựng lại cấu trúc bảng (hàng = ngày, cột = xe) ->
// tách nội dung từng ô thành buổi Sáng/Chiều -> hiển thị bản xem trước để
// Cán bộ quản lý kiểm tra -> bấm "Áp dụng" để nạp vào trình soạn của TUẦN
// đang chọn (chưa ghi vào Firestore) -> người dùng tự kiểm tra, sửa nếu cần,
// rồi bấm nút "Lưu lịch phân xe tuần này" sẵn có để lưu thật.

let importParsedDays = null; // [{ dayIdx, labelRaw, cars: { carId: {morning, afternoon} } }]

els.toggleImportBtn.addEventListener("click", () => {
  const show = els.importPanel.style.display === "none";
  els.importPanel.style.display = show ? "" : "none";
  els.toggleImportBtn.textContent = show ? "Nhập dữ liệu từ file (Word/PDF) ▴" : "Nhập dữ liệu từ file (Word/PDF) ▾";
});

function normalizePlate(s) {
  return String(s || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

const PLATE_RE = /\d{2}\s*[A-Za-z]{1,2}[\s-]*\d{3}[\.\s]*\d{2}/g;

// Tách 1 đoạn nội dung tự do trong ô thành { session: 'morning'|'afternoon', content }.
// Ưu tiên tiền tố "Sáng:"/"Chiều:" ghi rõ trong văn bản; nếu không có, suy luận
// theo giờ xuất hiện đầu câu (trước 12h -> Sáng, từ 12h trở đi -> Chiều); nếu
// không có cả hai, mặc định xếp vào buổi Sáng để Cán bộ quản lý tự kiểm tra lại.
function classifyScheduleEntry(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.startsWith("sáng")) {
    const rest = text.replace(/^sáng\s*:?\s*/i, "").trim();
    return { session: "morning", content: rest || text };
  }
  if (lower.startsWith("chiều")) {
    const rest = text.replace(/^chiều\s*:?\s*/i, "").trim();
    return { session: "afternoon", content: rest || text };
  }
  const timeMatch = text.match(/(\d{1,2})\s*h\s*\d{0,2}/i);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    return { session: hour < 12 ? "morning" : "afternoon", content: text };
  }
  return { session: "morning", content: text };
}

function mergeEntryIntoDay(dayCarsMap, carId, entry) {
  if (!entry) return;
  if (!dayCarsMap[carId]) dayCarsMap[carId] = { morning: "", afternoon: "" };
  const cur = dayCarsMap[carId][entry.session];
  dayCarsMap[carId][entry.session] = cur ? cur + "\n" + entry.content : entry.content;
}

// Khớp các cột tiêu đề của bảng (mỗi cột ứng với 1 xe) với danh sách `cars`
// hiện tại, dựa trên biển số. Nếu không khớp được bằng biển số (file có định
// dạng khác/lỗi chính tả), khớp theo đúng thứ tự cột như danh sách xe.
function matchHeaderColumnsToCars(headerTexts) {
  const mapping = []; // carId theo từng cột (headerTexts[i] -> mapping[i])
  const usedCars = new Set();
  headerTexts.forEach((txt) => {
    const norm = normalizePlate(txt);
    const found = cars.find((c) => !usedCars.has(c.id) && norm.includes(normalizePlate(c.bienSo)) && normalizePlate(c.bienSo).length >= 6);
    mapping.push(found ? found.id : null);
    if (found) usedCars.add(found.id);
  });
  let matchedCount = mapping.filter(Boolean).length;
  if (matchedCount < Math.min(headerTexts.length, cars.length)) {
    // Khớp theo vị trí cho các cột chưa xác định được bằng biển số.
    headerTexts.forEach((_, i) => {
      if (!mapping[i] && cars[i] && !usedCars.has(cars[i].id)) {
        mapping[i] = cars[i].id;
        usedCars.add(cars[i].id);
      }
    });
  }
  return mapping;
}

// ---------------- Phân tích file Word (.docx) bằng mammoth.js ----------------

async function parseDocxArrayBuffer(arrayBuffer) {
  if (!window.mammoth) throw new Error("Thư viện đọc file Word chưa sẵn sàng, vui lòng tải lại trang và thử lại.");
  const result = await window.mammoth.convertToHtml({ arrayBuffer });
  const container = document.createElement("div");
  container.innerHTML = result.value;
  const tables = Array.from(container.querySelectorAll("table"));
  // Bảng lịch phân xe là bảng có nhiều cột nhất (1 cột Ngày + N cột xe).
  let scheduleTable = null;
  tables.forEach((t) => {
    const firstRowCells = t.rows[0] ? t.rows[0].cells.length : 0;
    if (!scheduleTable || firstRowCells > scheduleTable.rows[0].cells.length) {
      scheduleTable = t;
    }
  });
  if (!scheduleTable || scheduleTable.rows.length < 2) {
    throw new Error("Không tìm thấy bảng Lịch phân xe trong file Word.");
  }

  const headerRow = scheduleTable.rows[0];
  const headerTexts = [];
  for (let i = 1; i < headerRow.cells.length; i++) {
    headerTexts.push(headerRow.cells[i].textContent.replace(/\s+/g, " ").trim());
  }
  const colToCarId = matchHeaderColumnsToCars(headerTexts);

  const dataRows = Array.from(scheduleTable.rows).slice(1);
  const warnings = [];
  if (dataRows.length !== 7) {
    warnings.push(`File có ${dataRows.length} hàng dữ liệu (thay vì 7 ngày Thứ Hai–Chủ Nhật) — vui lòng kiểm tra lại.`);
  }

  const days = [];
  for (let dayIdx = 0; dayIdx < Math.min(7, dataRows.length); dayIdx++) {
    const row = dataRows[dayIdx];
    const labelRaw = row.cells[0] ? row.cells[0].textContent.replace(/\s+/g, " ").trim() : "";
    const dayCarsMap = {};
    for (let col = 0; col < colToCarId.length; col++) {
      const carId = colToCarId[col];
      if (!carId) continue;
      const cell = row.cells[col + 1];
      if (!cell) continue;
      const paras = Array.from(cell.querySelectorAll("p"));
      const texts = paras.length ? paras.map((p) => p.textContent) : [cell.textContent];
      texts.forEach((t) => mergeEntryIntoDay(dayCarsMap, carId, classifyScheduleEntry(t)));
    }
    days.push({ dayIdx, labelRaw, cars: dayCarsMap });
  }
  return { days, warnings, colToCarId };
}

// ---------------- Phân tích file PDF bằng pdf.js (thử nghiệm) ----------------

async function parsePdfArrayBuffer(arrayBuffer) {
  if (!window.pdfjsLib) throw new Error("Thư viện đọc file PDF chưa sẵn sàng, vui lòng tải lại trang và thử lại.");
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allItems = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    content.items.forEach((it) => {
      const str = (it.str || "").trim();
      if (!str) return;
      allItems.push({ str, x: it.transform[4], y: Math.round(it.transform[5]) });
    });
  }
  // Gom các mục theo dòng (cùng toạ độ y, sai số nhỏ), sắp theo thứ tự đọc.
  allItems.sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  allItems.forEach((it) => {
    let line = lines.find((l) => Math.abs(l.y - it.y) <= 3);
    if (!line) {
      line = { y: it.y, items: [] };
      lines.push(line);
    }
    line.items.push(it);
  });
  lines.sort((a, b) => b.y - a.y);
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));

  // Tìm dòng tiêu đề chứa nhiều biển số nhất -> dùng vị trí x của các biển số
  // đó làm ranh giới cột cho từng xe.
  let headerLine = null;
  let headerPlates = [];
  lines.forEach((l) => {
    const plates = l.items.filter((it) => /\d{2}[A-Za-z]-?\d{3}\.?\d{2}/.test(it.str));
    if (plates.length > headerPlates.length) {
      headerLine = l;
      headerPlates = plates;
    }
  });
  if (!headerLine || headerPlates.length < 2) {
    throw new Error("Không nhận diện được dòng tiêu đề (biển số xe) trong file PDF. Vui lòng dùng file Word (.docx) để nhập tự động chính xác hơn.");
  }
  const colBoundaries = headerPlates.map((it) => it.x).sort((a, b) => a - b);
  const colToCarId = matchHeaderColumnsToCars(headerPlates.sort((a, b) => a.x - b.x).map((it) => it.str));

  function bucketOf(x) {
    let idx = -1;
    for (let i = 0; i < colBoundaries.length; i++) {
      if (x >= colBoundaries[i] - 8) idx = i;
    }
    return idx; // -1 = cột Ngày (bên trái cột xe đầu tiên)
  }

  const headerY = headerLine.y;
  const bodyLines = lines.filter((l) => l.y < headerY - 5);

  // Tìm các dòng bắt đầu 1 ngày mới (chứa "Thứ ..."/"Chủ nhật" ở cột Ngày).
  const WEEKDAY_RE = /Thứ\s+(Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ\s*nhật/i;
  const startIdxs = [];
  bodyLines.forEach((l, idx) => {
    const dayColText = l.items.filter((it) => bucketOf(it.x) === -1).map((it) => it.str).join(" ");
    if (WEEKDAY_RE.test(dayColText)) startIdxs.push(idx);
  });

  const warnings = ["Dữ liệu nhập từ file PDF là tính năng thử nghiệm — vui lòng kiểm tra kỹ lại nội dung trước khi lưu."];
  const bandEnds = [...startIdxs.slice(1), bodyLines.length];
  const bands = startIdxs.length
    ? startIdxs.map((start, i) => [start, bandEnds[i]])
    : [[0, bodyLines.length]]; // không tìm được nhãn thứ nào -> coi cả phần còn lại là 1 ngày (hiếm)
  // Hàng đầu tiên (Thứ Hai) thường không có nhãn (ví dụ lỗi chính tả trong văn bản gốc)
  // -> phần từ đầu bodyLines tới trước band đầu tiên được gán cho ngày 0.
  if (startIdxs.length && startIdxs[0] > 0) {
    bands.unshift([0, startIdxs[0]]);
  }
  if (bands.length !== 7) {
    warnings.push(`Nhận diện được ${bands.length} ngày thay vì 7 — vui lòng kiểm tra lại, có thể cần sửa thủ công.`);
  }

  const days = [];
  for (let dayIdx = 0; dayIdx < Math.min(7, bands.length); dayIdx++) {
    const [from, to] = bands[dayIdx];
    const dayCarsMap = {};
    for (let li = from; li < to; li++) {
      const line = bodyLines[li];
      if (!line) continue;
      // Gom theo cột trong cùng 1 dòng.
      const byBucket = {};
      line.items.forEach((it) => {
        const b = bucketOf(it.x);
        if (b < 0) return;
        byBucket[b] = (byBucket[b] ? byBucket[b] + " " : "") + it.str;
      });
      Object.keys(byBucket).forEach((bStr) => {
        const b = Number(bStr);
        const carId = colToCarId[b];
        if (!carId) return;
        mergeEntryIntoDay(dayCarsMap, carId, classifyScheduleEntry(byBucket[b]));
      });
    }
    days.push({ dayIdx, labelRaw: "", cars: dayCarsMap });
  }
  return { days, warnings, colToCarId };
}

function renderImportPreview(parsed) {
  const rows = parsed.days.map((d) => {
    const cells = cars.map((c) => {
      const cc = d.cars[c.id] || { morning: "", afternoon: "" };
      const sang = escapeHtml(cc.morning || "—");
      const chieu = escapeHtml(cc.afternoon || "—");
      return `<td><div><b>S:</b> ${sang}</div><div><b>C:</b> ${chieu}</div></td>`;
    }).join("");
    return `<tr><td>${escapeHtml(WEEKDAY_LABELS[d.dayIdx])}</td>${cells}</tr>`;
  }).join("");
  const head = `<tr><th>Ngày</th>${cars.map((c) => `<th>${escapeHtml(c.bienSo)}</th>`).join("")}</tr>`;
  els.importPreview.innerHTML = `
    <div class="import-preview-scroll">
      <table class="import-preview-table">
        <thead>${head}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

els.importParseBtn.addEventListener("click", async () => {
  const file = els.importFile.files[0];
  if (!file) {
    banner(els.importStatus, "Vui lòng chọn file Word (.docx) hoặc PDF trước.", "error");
    return;
  }
  const name = file.name.toLowerCase();
  els.importParseBtn.disabled = true;
  els.importApplyBtn.style.display = "none";
  importParsedDays = null;
  els.importPreview.innerHTML = "";
  banner(els.importStatus, "Đang phân tích file…", "info");
  try {
    const buf = await file.arrayBuffer();
    let parsed;
    if (name.endsWith(".docx")) {
      parsed = await parseDocxArrayBuffer(buf);
    } else if (name.endsWith(".pdf")) {
      parsed = await parsePdfArrayBuffer(buf);
    } else {
      throw new Error("Chỉ hỗ trợ file .docx (Word) hoặc .pdf.");
    }
    importParsedDays = parsed.days;
    renderImportPreview(parsed);
    const warnMsg = parsed.warnings.length ? " — " + parsed.warnings.join(" ") : "";
    banner(els.importStatus, `Đã phân tích xong. Vui lòng kiểm tra bản xem trước bên dưới, sau đó bấm "Áp dụng vào tuần đang chọn".${warnMsg}`, parsed.warnings.length ? "info" : "success");
    els.importApplyBtn.style.display = "";
  } catch (e) {
    console.error(e);
    banner(els.importStatus, "Lỗi khi phân tích file: " + e.message, "error");
  } finally {
    els.importParseBtn.disabled = false;
  }
});

els.importApplyBtn.addEventListener("click", () => {
  if (!importParsedDays) return;
  if (!confirm("Áp dụng dữ liệu vừa phân tích vào TUẦN ĐANG CHỌN trên trình soạn? Nội dung đang sửa dở (chưa lưu) của tuần này sẽ bị ghi đè. Bạn vẫn cần bấm \"Lưu lịch phân xe tuần này\" sau đó để lưu thật.")) {
    return;
  }
  const monday = weekIdToMonday(currentWeekId);
  const dateStrs = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dateStrs.push(toDateStr(d));
  }
  cars.forEach((c) => {
    if (!currentWeekData[c.id]) currentWeekData[c.id] = { carId: c.id, days: buildWeekDays(monday) };
  });
  importParsedDays.forEach((d) => {
    const dateStr = dateStrs[d.dayIdx];
    cars.forEach((c) => {
      const entry = ensureDayEntry(c.id, dateStr, d.dayIdx, monday);
      const found = d.cars[c.id];
      if (found) {
        if (found.morning) entry.sessions.morning = found.morning;
        if (found.afternoon) entry.sessions.afternoon = found.afternoon;
      }
    });
  });
  renderDaysEditor();
  banner(els.saveStatus, "Đã nạp dữ liệu từ file vào tuần đang chọn — vui lòng kiểm tra lại từng ô rồi bấm \"Lưu lịch phân xe tuần này\".", "success");
  els.importPanel.style.display = "none";
  els.toggleImportBtn.textContent = "Nhập dữ liệu từ file (Word/PDF) ▾";
});
