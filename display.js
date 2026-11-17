// ============================================================================
// display.js — Logic cho trang hiển thị công khai (index.html)
// ============================================================================

import {
  doc,
  getDoc,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, getWeekId, formatDMY, weekIdToMonday, toDateStr, WEEKDAY_LABELS } from "./shared.js";
import { DEFAULT_CARS } from "./firebase-config.js";

const els = {
  weekRangeText: document.getElementById("weekRangeText"),
  statusArea: document.getElementById("statusArea"),
  loadingArea: document.getElementById("loadingArea"),
  tableWrap: document.getElementById("tableWrap"),
  tableHeadRow: document.getElementById("tableHeadRow"),
  tableBody: document.getElementById("tableBody"),
  dayCards: document.getElementById("dayCards"),
  officialWrap: document.getElementById("officialWrap"),
  officialWeekText: document.getElementById("officialWeekText"),
  officialHeadRow: document.getElementById("officialHeadRow"),
  officialBody: document.getElementById("officialBody"),
  viewCardBtn: document.getElementById("viewCardBtn"),
  viewOfficialBtn: document.getElementById("viewOfficialBtn"),
  prevBtn: document.getElementById("prevWeekBtn"),
  nextBtn: document.getElementById("nextWeekBtn"),
  thisBtn: document.getElementById("thisWeekBtn"),
};

const VIEW_MODE_KEY = "lptOnlineViewMode";
let viewMode = localStorage.getItem(VIEW_MODE_KEY) === "official" ? "official" : "card";

let currentWeekId = getWeekId(new Date());
let unsubscribeWeek = null;
let cars = DEFAULT_CARS;
let carsLoaded = false;

function showStatus(msg, type = "info") {
  if (!msg) {
    els.statusArea.innerHTML = "";
    return;
  }
  els.statusArea.innerHTML = `<div class="status-banner ${type}">${escapeHtml(msg)}</div>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function loadCars() {
  try {
    const snap = await getDoc(doc(db, "settings", "cars"));
    if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length) {
      cars = snap.data().list;
    }
  } catch (e) {
    console.warn("Không tải được danh sách xe, dùng danh sách mặc định.", e);
  }
  carsLoaded = true;
}

function renderHeader() {
  els.tableHeadRow.innerHTML = `<th style="width:90px;">Ngày</th>` +
    cars.map((c) => `
      <th>
        <span class="leader-name">${escapeHtml(c.bienSo)}</span>
        <span class="leader-title">${escapeHtml(c.taiXe)}</span>
      </th>`).join("");
}

function sessionHtml(text) {
  const t = (text || "").trim();
  if (!t) return `<span class="session-text empty">Chưa có nội dung</span>`;
  return `<span class="session-text">${escapeHtml(t)}</span>`;
}

function dateStrsOfWeek(weekId) {
  const monday = weekIdToMonday(weekId);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    out.push(toDateStr(d));
  }
  return out;
}

function textFor(carsData, carId, dateStr) {
  const data = carsData[carId];
  if (!data || !Array.isArray(data.days)) return "";
  const day = data.days.find((d) => d.date === dateStr);
  return day ? day.text || "" : "";
}

function renderWeek(carsData) {
  renderHeader();
  const dateStrs = dateStrsOfWeek(currentWeekId);

  // ---- desktop table ----
  els.tableBody.innerHTML = dateStrs.map((dateStr, i) => {
    const cells = cars.map((c) => {
      const block = `
        <div class="session-block">
          ${sessionHtml(textFor(carsData, c.id, dateStr))}
        </div>`;
      return `<td>${block}</td>`;
    }).join("");
    return `
      <tr>
        <td class="day-cell">${WEEKDAY_LABELS[i]}<span class="d">(${formatDMY(dateStr)})</span></td>
        ${cells}
      </tr>`;
  }).join("");

  // ---- mobile cards ----
  els.dayCards.innerHTML = dateStrs.map((dateStr, i) => {
    const rows = cars.map((c) => {
      const block = `
        <div class="session-block">
          ${sessionHtml(textFor(carsData, c.id, dateStr))}
        </div>`;
      return `
        <div class="leader-row">
          <div class="leader-name">${escapeHtml(c.bienSo)}</div>
          <div class="leader-title">${escapeHtml(c.taiXe)}${c.dienThoai ? " — " + escapeHtml(c.dienThoai) : ""}</div>
          ${block}
        </div>`;
    }).join("");
    return `
      <div class="day-card">
        <div class="day-head"><span>${WEEKDAY_LABELS[i]}</span><span class="d">${formatDMY(dateStr)}</span></div>
        ${rows}
      </div>`;
  }).join("");
}

// ---- che do "Dang bang Thong bao" ----

function renderOfficialHeader() {
  els.officialHeadRow.innerHTML = `<th style="width:90px;">Ngày</th>` +
    cars.map((c) => `
      <th>
        <div class="official-leader-name">${escapeHtml(c.bienSo)}</div>
        <div class="official-leader-title">${escapeHtml(c.taiXe)}</div>
      </th>`).join("");
}

function officialCellHtml(carsData, carId, dateStr) {
  const t = (textFor(carsData, carId, dateStr) || "").trim();
  if (!t) return `<div class="official-line">&nbsp;</div>`;
  return `<div class="official-line">${escapeHtml(t).replace(/\n/g, "<br/>")}</div>`;
}

function renderOfficialTable(carsData) {
  renderOfficialHeader();
  const dateStrs = dateStrsOfWeek(currentWeekId);
  els.officialBody.innerHTML = dateStrs.map((dateStr, i) => {
    const cells = cars.map((c) => `<td>${officialCellHtml(carsData, c.id, dateStr)}</td>`).join("");
    return `
      <tr>
        <td class="official-day-cell">
          <div>${WEEKDAY_LABELS[i]}</div>
          <div class="official-d">(${formatDMY(dateStr)})</div>
        </td>
        ${cells}
      </tr>`;
  }).join("");
}

function weekLabelParts(weekId) {
  const monday = weekIdToMonday(weekId);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const wk = weekId.split("-W")[1];
  return { wk, start: formatDMY(toDateStr(monday)), end: formatDMY(toDateStr(sunday)) };
}

function updateWeekRangeLabel(weekId) {
  const p = weekLabelParts(weekId);
  els.weekRangeText.textContent = `Tuần ${p.wk}, từ ngày ${p.start} đến ngày ${p.end}`;
}

function updateOfficialHeaderText(weekId) {
  const p = weekLabelParts(weekId);
  els.officialWeekText.textContent = `(Tuần ${p.wk}, từ ngày ${p.start} đến ngày ${p.end})`;
}

function applyViewMode() {
  const isOfficial = viewMode === "official";
  els.officialWrap.style.display = isOfficial ? "" : "none";
  els.tableWrap.style.display = isOfficial ? "none" : "";
  els.dayCards.style.display = isOfficial ? "none" : "";
  els.viewCardBtn.classList.toggle("active", !isOfficial);
  els.viewOfficialBtn.classList.toggle("active", isOfficial);
}

els.viewCardBtn.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem(VIEW_MODE_KEY, viewMode);
  applyViewMode();
});

els.viewOfficialBtn.addEventListener("click", () => {
  viewMode = "official";
  localStorage.setItem(VIEW_MODE_KEY, viewMode);
  applyViewMode();
});

function subscribeToWeek(weekId) {
  if (unsubscribeWeek) unsubscribeWeek();
  els.loadingArea.style.display = "";
  els.tableWrap.style.display = "none";
  els.dayCards.style.display = "none";
  els.officialWrap.style.display = "none";
  showStatus("");
  updateWeekRangeLabel(weekId);
  updateOfficialHeaderText(weekId);

  const colRef = collection(db, "weeks", weekId, "cars");
  unsubscribeWeek = onSnapshot(
    colRef,
    (snap) => {
      els.loadingArea.style.display = "none";
      const carsData = {};
      snap.forEach((d) => (carsData[d.id] = d.data()));
      if (snap.empty) {
        showStatus("Chưa có lịch phân xe cho tuần này.", "info");
      }
      renderWeek(carsData);
      renderOfficialTable(carsData);
      applyViewMode();
    },
    (err) => {
      els.loadingArea.style.display = "none";
      console.error(err);
      showStatus("Không thể tải dữ liệu lịch phân xe. Vui lòng kiểm tra kết nối mạng hoặc liên hệ quản trị viên.", "error");
    }
  );
}

function goToWeek(weekId) {
  currentWeekId = weekId;
  subscribeToWeek(currentWeekId);
}

els.prevBtn.addEventListener("click", () => {
  const monday = weekIdToMonday(currentWeekId);
  monday.setDate(monday.getDate() - 7);
  goToWeek(getWeekId(monday));
});

els.nextBtn.addEventListener("click", () => {
  const monday = weekIdToMonday(currentWeekId);
  monday.setDate(monday.getDate() + 7);
  goToWeek(getWeekId(monday));
});

els.thisBtn.addEventListener("click", () => {
  goToWeek(getWeekId(new Date()));
});

(async function init() {
  await loadCars();
  subscribeToWeek(currentWeekId);
})();
