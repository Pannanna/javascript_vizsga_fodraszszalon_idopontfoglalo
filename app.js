const BASE_URL = "http://salonsapi.prooktatas.hu/api";
const API_KEY = "vizsga2026kulcs"; 

let hairdressers = [];
let selectedHairdresser = null;
let selectedTime = null;

function $(id) { return document.getElementById(id); }

function showStep(n) {
  $("step1").style.display = n === 1 ? "block" : "none";
  $("step2").style.display = n === 2 ? "block" : "none";
  $("step3").style.display = n === 3 ? "block" : "none";
}

function setStep1Error(msg) { $("step1Error").innerText = msg || ""; }
function setError(msg) { $("error").innerText = msg || ""; }

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseHHMM(str) {
  const s = String(str).slice(0, 5);
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function toHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function getWorkingHours(hd) {
  const start = hd.work_start || hd.workStart || hd.start || hd.start_time || hd.startTime;
  const end   = hd.work_end   || hd.workEnd   || hd.end   || hd.end_time   || hd.endTime;

  if (!start || !end) return null;

  const s = String(start).slice(0, 5);
  const e = String(end).slice(0, 5);

  if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) return null;
  return { start: s, end: e };
}

function buildHalfHourSlots(startHHMM, endHHMM) {
  const startMin = parseHHMM(startHHMM);
  const endMin = parseHHMM(endHHMM);
  if (startMin === null || endMin === null) return [];

  const slots = [];
  for (let m = startMin; m + 30 <= endMin; m += 30) {
    slots.push(toHHMM(m));
  }
  return slots;
}

function renderHairdressers() {
  const container = $("hairdressers");
  container.innerHTML = "";

  hairdressers.forEach(h => {
    const div = document.createElement("div");
    div.className = "hd";
    div.innerHTML = `
  <strong>${h.name || "Névtelen fodrász"}</strong>
  <span>${h.description || ""}</span>
  <div class="bookbtn">
    <button class="primary" type="button">IDŐPONTFOGLALÁS</button>
  </div>
`;
    div.onclick = () => selectHairdresser(h);
    container.appendChild(div);
  });
}

function selectHairdresser(h) {
  selectedHairdresser = h;
  selectedTime = null;
  setError("");

  $("selectedName").innerText = h.name || "";
  $("dateInput").value = toYMD(new Date());

  showStep(2);
  loadFreeTimesForSelectedDate();
}

function renderTimeButtons(times) {
  const container = $("timeSlots");
  container.innerHTML = "";
  selectedTime = null;

  if (times.length === 0) {
    container.innerText = "Nincs szabad időpont erre a napra.";
    return;
  }

  times.forEach(time => {
    const btn = document.createElement("button");
    btn.innerText = time;
    btn.onclick = () => {
      document.querySelectorAll("#timeSlots button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedTime = time;
    };
    container.appendChild(btn);
  });
}

async function fetchHairdressers() {
  const res = await fetch(`${BASE_URL}/hairdressers`);
  if (!res.ok) throw new Error(`HTTP ${res.status} – nem sikerült lekérdezni a fodrászokat`);
  return res.json();
}

async function fetchAppointments() {
  const res = await fetch(`${BASE_URL}/appointments?api_key=${encodeURIComponent(API_KEY)}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${text}`);
  try { return JSON.parse(text); } catch { return []; }
}

async function createAppointment(payload) {
  const res = await fetch(`${BASE_URL}/appointments?api_key=${encodeURIComponent(API_KEY)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${text}`);
  try { return JSON.parse(text); } catch { return {}; }
}

async function loadFreeTimesForSelectedDate() {
  setError("");

  if (!selectedHairdresser) return;

  const date = $("dateInput").value;
  if (!date) return;

  const wh = getWorkingHours(selectedHairdresser) || { start: "09:00", end: "18:00" };
  const allSlots = buildHalfHourSlots(wh.start, wh.end);

  try {
    const appointments = await fetchAppointments();

    const busyTimes = appointments
      .filter(a => Number(a.hairdresser_id) === Number(selectedHairdresser.id))
      .map(a => String(a.appointment_date || ""))
      .filter(dt => dt.startsWith(date))
      .map(dt => dt.slice(11, 16));

    const free = allSlots.filter(t => !busyTimes.includes(t));
    renderTimeButtons(free);
  } catch (e) {
    $("timeSlots").innerHTML = "";
    setError(e.message);
  }
}

async function bookAppointment() {
  setError("");

  if (!selectedHairdresser) {
    setError("Nincs kiválasztott fodrász.");
    return;
  }

  const date = $("dateInput").value;
  if (!date) {
    setError("Válassz dátumot!");
    return;
  }

  if (!selectedTime) {
    setError("Válassz egy időpontot!");
    return;
  }

  const name = $("customerName").value.trim();
  const phone = $("customerPhone").value.trim();
  const service = $("service").value.trim();

  if (!name || !phone || !service) {
    setError("Minden mező kitöltése kötelező!");
    return;
  }

  const payload = {
    hairdresser_id: Number(selectedHairdresser.id),
    api_key: API_KEY,
    customer_name: name,
    customer_phone: phone,
    appointment_date: `${date} ${selectedTime}:00`,
    service: service
  };

  try {
    await createAppointment(payload);
    showStep(3);
  } catch (e) {
    setError(e.message);
  }
}

function backToStep1() {
  selectedHairdresser = null;
  selectedTime = null;
  $("timeSlots").innerHTML = "";
  setError("");
  showStep(1);
}

async function init() {
  showStep(1);
  setStep1Error("");
  setError("");

  try {
    hairdressers = await fetchHairdressers();
    renderHairdressers();
  } catch (e) {
    setStep1Error(e.message);
  }
}

init();

window.backToStep1 = backToStep1;
window.bookAppointment = bookAppointment;
window.loadFreeTimesForSelectedDate = loadFreeTimesForSelectedDate;