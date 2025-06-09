// Enhanced Homestay Booking - script.js

// Firebase Firestore reference (initialized in index.html)
const bookingsRef = firebase.firestore().collection("bookings");

let bookingsList = [];

// DOM Elements
const tbody = document.querySelector("#bookingTable tbody");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportCSV");
const summary = document.getElementById("dashboardSummary");

// Utilities
const datesBetween = (s, e) => {
  const arr = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1))
    arr.push(d.toISOString().slice(0, 10));
  return arr;
};

const isAvailable = async (type, num, inD, outD, ignoreId = null) => {
  const snap = await bookingsRef.get();
  const list = snap.docs.map(doc => doc.data());
  return datesBetween(new Date(inD), new Date(outD)).every(date => {
    const booked = list.reduce((sum, b) => {
      if (b.roomType !== type || (ignoreId && b.id === ignoreId)) return sum;
      const d = new Date(date);
      return (d >= new Date(b.checkIn) && d <= new Date(b.checkOut)) ? sum + +b.numRooms : sum;
    }, 0);
    return booked + +num <= (type === "Deluxe" ? 3 : 2);
  });
};

const updateSummary = () => {
  const total = bookingsList.length;
  const advance = bookingsList.reduce((sum, b) => sum + Number(b.advance), 0);
  const today = new Date().toISOString().slice(0, 10);
  const occupiedToday = bookingsList.filter(b => today >= b.checkIn && today <= b.checkOut)
    .reduce((acc, b) => {
      acc[b.roomType] = (acc[b.roomType] || 0) + +b.numRooms;
      return acc;
    }, {});
  const deluxeLeft = 3 - (occupiedToday["Deluxe"] || 0);
  const superLeft = 2 - (occupiedToday["Super Deluxe"] || 0);

  summary.innerHTML = `
    <p>Total Bookings: <strong>${total}</strong></p>
    <p>Total Advance: ₹<strong>${advance}</strong></p>
    <p>Rooms Available Today: Deluxe (<strong>${deluxeLeft}</strong>), Super Deluxe (<strong>${superLeft}</strong>)</p>
  `;
};

const addRow = (tb, b) => {
  const tr = document.createElement("tr");
  tr.dataset.id = b.id;
  tr.innerHTML = `
    <td>${b.guestName}</td>
    <td>${b.contactNo}</td>
    <td>${b.checkIn}</td>
    <td>${b.checkOut}</td>
    <td>${b.numRooms}</td>
    <td>${b.roomType}</td>
    <td>${b.advance}</td>
    <td><button class="editBtn" title="Edit">✏️</button></td>
    <td><button class="delBtn" title="Delete">🗑️</button></td>`;
  tb.appendChild(tr);
};

const renderBookings = (list) => {
  tbody.innerHTML = "";
  list.forEach(b => addRow(tbody, b));
  renderCalendar(list);
  updateSummary();
};

const renderCalendar = (list) => {
  const calEl = document.getElementById("calendar");
  if (!calEl) return;
  calEl.innerHTML = "";
  const cal = new FullCalendar.Calendar(calEl, {
    initialView: "dayGridMonth",
    height: "auto",
    events: list.map(b => ({
      title: `${b.guestName} (${b.numRooms} ${b.roomType})`,
      start: b.checkIn,
      end: new Date(new Date(b.checkOut).getTime() + 86_400_000).toISOString().slice(0, 10),
      allDay: true
    })),
    eventColor: "#ff6f61"
  });
  cal.render();
};

bookingsRef.onSnapshot(snapshot => {
  bookingsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderBookings(bookingsList);
});

// Form submission
bookingForm.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const id = f.editId.value || bookingsRef.doc().id;
  const booking = {
    guestName: f.guestName.value.trim(),
    contactNo: f.contactNo.value.trim(),
    checkIn: f.checkIn.value,
    checkOut: f.checkOut.value,
    advance: f.advance.value,
    numRooms: f.numRooms.value,
    roomType: f.roomType.value
  };
  const msg = document.getElementById("entryMessage");
  if (new Date(booking.checkOut) <= new Date(booking.checkIn)) {
    msg.textContent = "Check-out must be after check-in.";
    return;
  }
  if (!(await isAvailable(booking.roomType, booking.numRooms, booking.checkIn, booking.checkOut, id))) {
    msg.textContent = "Selected room type not available.";
    return;
  }
  msg.textContent = "";
  await bookingsRef.doc(id).set(booking);
  f.reset();
  f.editId.value = "";
  document.getElementById("submitBtn").textContent = "Add Booking";
});

// Edit/Delete Buttons
tbody.addEventListener("click", e => {
  const row = e.target.closest("tr");
  const id = row.dataset.id;
  const b = bookingsList.find(x => x.id === id);
  if (e.target.classList.contains("delBtn")) {
    if (confirm("Delete this booking?")) bookingsRef.doc(id).delete();
  }
  if (e.target.classList.contains("editBtn")) {
    const f = document.getElementById("bookingForm");
    Object.entries(b).forEach(([k, v]) => f[k] && (f[k].value = v));
    f.editId.value = id;
    document.getElementById("submitBtn").textContent = "Update Booking";
    document.querySelector('.tabs li[data-tab="entry"]').click();
  }
});

// Availability Checker
checkAvailability.addEventListener("click", () => {
  const d = availDate.value;
  if (!d) return;
  const result = ["Deluxe", "Super Deluxe"].map(t => {
    const booked = bookingsList.reduce((sum, b) => {
      if (b.roomType !== t) return sum;
      const cur = new Date(d);
      return (cur >= new Date(b.checkIn) && cur <= new Date(b.checkOut)) ? sum + +b.numRooms : sum;
    }, 0);
    return `${t}: ${(t === "Deluxe" ? 3 : 2) - booked} available`;
  });
  availabilityResult.textContent = result.join(" | ");
});

// Tab switching
[...document.querySelectorAll(".tabs li")].forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelector(".tabs li.active")?.classList.remove("active");
    document.querySelector(".tab.active")?.classList.remove("active");
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// Search/filter
searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  const filtered = bookingsList.filter(b =>
    b.guestName.toLowerCase().includes(term) ||
    b.roomType.toLowerCase().includes(term) ||
    b.contactNo.includes(term)
  );
  renderBookings(filtered);
});

// CSV Export
exportBtn.addEventListener("click", () => {
  const rows = [
    ["Guest Name", "Contact No.", "Check-in", "Check-out", "#Rooms", "Room Type", "Advance"]
  ].concat(bookingsList.map(b => [
    b.guestName, b.contactNo, b.checkIn, b.checkOut, b.numRooms, b.roomType, b.advance
  ]));
  const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "bookings.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
