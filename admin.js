const BASE_URL = "http://salonsapi.prooktatas.hu/api";
const API_KEY = "vizsga2026kulcs";

function $(id) { return document.getElementById(id); }

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

async function loadAppointments() {
  const container = $("appointments");
  container.innerHTML = "Betöltés...";

  try {
    const [hairdressers, appointments] = await Promise.all([
      fetchHairdressers(),
      fetchAppointments()
    ]);

    const nameById = new Map();
    hairdressers.forEach(h => nameById.set(Number(h.id), h.name || `Fodrász #${h.id}`));

    const groups = new Map();
    appointments.forEach(a => {
      const id = Number(a.hairdresser_id);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(a);
    });

    container.innerHTML = "";

    if (appointments.length === 0) {
      container.innerText = "Nincs foglalás.";
      return;
    }

    Array.from(groups.keys()).sort((a, b) => a - b).forEach(id => {
      const title = document.createElement("h2");
      title.innerText = nameById.get(id) || `Fodrász #${id}`;
      container.appendChild(title);

      groups.get(id)
        .slice()
        .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date)))
        .forEach(a => {
          const row = document.createElement("div");
          row.innerText = `${a.appointment_date} | ${a.customer_name} | ${a.customer_phone} | ${a.service}`;
          container.appendChild(row);
        });
    });

  } catch (e) {
    container.innerText = e.message;
  }
}

window.loadAppointments = loadAppointments;