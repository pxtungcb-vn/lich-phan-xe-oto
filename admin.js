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
let currentWeekData = {};
let currentAccount = null;

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

// ---------------- Dang nhap / dang xuat ----------------

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
  els.carsPanel.style.display = "none";
  els.accountsPanel.style.display = "none";
  els.passwordPanel.style.display = "none";
}

// ---------------- Doi mat khau cua toi (moi vai tro) ----------------

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

// ---------------- Danh sach xe ----------------

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

// ---------------- Quan ly tai khoan dang nhap ----------------

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

// ---------------- Tai / dieu huong tuan ----------------

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

async function fetchWeekData(weekId, monday) {
  const result = {};
  const snap = await getDocs(collection(db, "weeks", weekId, "cars"));
  const existing = {};
  snap.forEach((d) => (existing[d.id] = d.data()));
  cars.forEach((c) => {
    result[c.id] = existing[c.id] && Array.isArray(existing[c.id].days)
      ? existing[c.id]
      : { carId: c.id, days: buildWeekDays(monday) };
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
          return { date: dateStr, weekday: WEEKDAY_LABELS[i], text: prevDay ? prevDay.text || "" : "" };
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

// ---------------- Soan / luu lich tuan ----------------

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
      return `
        <div class="car-edit-block${currentAccount.role === "driver" ? " my-car" : ""}">
          <div class="car-title">${escapeHtml(c.bienSo)} (${escapeHtml(c.taiXe)})</div>
          <textarea data-day="${dayIdx}" data-car="${c.id}" placeholder="Giờ và nội dung công việc…">${escapeHtml(entry.text || "")}</textarea>
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
    entry = { date: dateStr, weekday: WEEKDAY_LABELS[dayIdx], text: "" };
    currentWeekData[carId].days.push(entry);
  }
  return entry;
}

function collectWeekDataFromForm() {
  els.daysEditor.querySelectorAll("textarea").forEach((ta) => {
    const dayIdx = Number(ta.dataset.day);
    const carId = ta.dataset.car;
    if (currentWeekData[carId] && currentWeekData[carId].days[dayIdx]) {
      currentWeekData[carId].days[dayIdx].text = ta.value;
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
