/**************************************************************************
 *  Homestay Booking  – CRUD  (Create, Read, Update, Delete) v2.1
 *  ─ adds automatic ID migration for older saved bookings
 **************************************************************************/

/* ─────────────  DATA HELPERS  ───────────── */
const MAX_ROOMS = { Deluxe: 3, 'Super Deluxe': 2 };

const loadBookings = () =>
  JSON.parse(localStorage.getItem('bookings') || '[]');

const saveBookings = (list) =>
  localStorage.setItem('bookings', JSON.stringify(list));

/*  PATCH LEGACY DATA: give every record an id (one-time)  */
(function migrateIds() {
  const list = loadBookings();
  let touched = false;

  list.forEach(b => {
    if (!b.id) {                                    // legacy entry
      b.id = (Date.now() + Math.random()).toString(36);
      touched = true;
    }
  });

  if (touched) saveBookings(list);                  // write back once
})();

/* ─────────────  TABLE RENDER  ───────────── */
function addRow(tb, b) {
  const tr = document.createElement('tr');
  tr.dataset.id = b.id;
  tr.innerHTML = `
    <td>${b.guestName}</td>
    <td>${b.contactNo}</td>
    <td>${b.checkIn}</td>
    <td>${b.checkOut}</td>
    <td>${b.numRooms}</td>
    <td>${b.roomType}</td>
    <td>${b.advance ? `₹ ${b.advance}` : '—'}</td>
    <td><button class="editBtn">✏️</button></td>
    <td><button class="delBtn">🗑️</button></td>`;
  tb.appendChild(tr);
}

function renderBookings() {
  const tbody = document.querySelector('#bookingTable tbody');
  tbody.innerHTML = '';
  loadBookings().forEach(b => addRow(tbody, b));
}

/* ─────────────  AVAILABILITY  ───────────── */
const datesBetween = (s, e) => {
  const arr = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1))
    arr.push(d.toISOString().slice(0, 10));
  return arr;
};

const roomsBookedForDate = (date, type) => loadBookings().reduce((sum, b) =>
  (b.roomType === type &&
   new Date(date) >= new Date(b.checkIn) &&
   new Date(date) <= new Date(b.checkOut))
     ? sum + +b.numRooms : sum, 0);

const isAvailable = (type, num, inD, outD, ignoreId = null) => {
  const numInt = +num;
  return datesBetween(new Date(inD), new Date(outD)).every(d => {
    const booked = loadBookings().reduce((sum, b) => {
      if (b.id === ignoreId || b.roomType !== type) return sum;
      return (new Date(d) >= new Date(b.checkIn) &&
              new Date(d) <= new Date(b.checkOut))
             ? sum + +b.numRooms : sum;
    }, 0);
    return booked + numInt <= MAX_ROOMS[type];
  });
};

/* ─────────────  CALENDAR  ───────────── */
const mapEvents = list => list.map(b => ({
  title: `${b.guestName} (${b.numRooms} ${b.roomType})`,
  start: b.checkIn,
  end:   new Date(new Date(b.checkOut).getTime() + 86_400_000)
            .toISOString().slice(0, 10),   // FullCalendar end is exclusive
  allDay: true
}));

function renderCalendar() {
  const el = document.getElementById('calendar'); if (!el) return;
  const cal = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: mapEvents(loadBookings()),
    eventColor: '#ff6f61'
  });
  cal.render();
}

/* ─────────────  CRUD ACTIONS  ───────────── */
function resetForm() {
  document.getElementById('bookingForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('submitBtn').textContent = 'Add Booking';
}

function saveBooking(obj) {
  const list = loadBookings();
  const idx  = list.findIndex(b => b.id === obj.id);
  if (idx > -1) list[idx] = obj; else list.push(obj);
  saveBookings(list);
}

function deleteBooking(id) {
  saveBookings(loadBookings().filter(b => b.id !== id));
  renderBookings();
  document.getElementById('calendar').innerHTML = '';
  renderCalendar();
}

/* ─────────────  DOM READY  ───────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* TAB SWITCH  */
  document.querySelectorAll('.tabs li').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelector('.tabs li.active')?.classList.remove('active');
      document.querySelector('.tab.active')?.classList.remove('active');
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.tab);
      panel.classList.add('active');
      if (tab.dataset.tab === 'calendar') {
        panel.innerHTML = ''; renderCalendar();
      }
    });
  });

  /* INITIAL RENDER */
  renderBookings();
  renderCalendar();

  /* FORM SUBMIT  (ADD or UPDATE) */
  document.getElementById('bookingForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const obj = {
      id: f.editId.value || (Date.now() + Math.random()).toString(36),
      guestName: f.guestName.value.trim(),
      contactNo: f.contactNo.value.trim(),
      checkIn:   f.checkIn.value,
      checkOut:  f.checkOut.value,
      advance:   f.advance.value,
      numRooms:  f.numRooms.value,
      roomType:  f.roomType.value
    };
    const msg = document.getElementById('entryMessage');

    if (!isAvailable(obj.roomType, obj.numRooms, obj.checkIn, obj.checkOut, obj.id)) {
      msg.textContent = 'Selected room type not available for chosen dates.';
      return;
    }
    msg.textContent = '';

    saveBooking(obj);
    renderBookings();
    document.getElementById('calendar').innerHTML = ''; renderCalendar();
    resetForm();
  });

  /* TABLE ACTIONS: EDIT or DELETE  */
  document.querySelector('#bookingTable tbody').addEventListener('click', e => {
    const row = e.target.closest('tr'); if (!row) return;
    const id  = row.dataset.id;

    if (e.target.classList.contains('delBtn')) {
      if (confirm('Delete this booking?')) deleteBooking(id);
    }

    if (e.target.classList.contains('editBtn')) {
      const b = loadBookings().find(x => x.id === id); if (!b) return;
      const f = document.getElementById('bookingForm');
      f.editId.value    = b.id;
      f.guestName.value = b.guestName;
      f.contactNo.value = b.contactNo;
      f.checkIn.value   = b.checkIn;
      f.checkOut.value  = b.checkOut;
      f.advance.value   = b.advance;
      f.numRooms.value  = b.numRooms;
      f.roomType.value  = b.roomType;
      document.getElementById('submitBtn').textContent = 'Update Booking';
      document.querySelector('.tabs li[data-tab="entry"]').click();
    }
  });

  /* AVAILABILITY CHECK */
  document.getElementById('checkAvailability').addEventListener('click', () => {
    const d = document.getElementById('availDate').value; if (!d) return;
    const res = Object.keys(MAX_ROOMS).map(t =>
      `${t}: ${MAX_ROOMS[t] - roomsBookedForDate(d, t)} available`);
    document.getElementById('availabilityResult').textContent = res.join('  |  ');
  });
});
