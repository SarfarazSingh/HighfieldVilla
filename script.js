// Get Firestore instance (initialized in index.html)
const bookingsRef = firebase.firestore().collection("bookings");

// Render helpers
function addRow(tb, b) {
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
    <td><button class="editBtn">✏️</button></td>
    <td><button class="delBtn">🗑️</button></td>`;
  tb.appendChild(tr);
}

function renderBookings(bookings) {
  const tbody = document.querySelector("#bookingTable tbody");
  tbody.innerHTML = "";
  bookings.forEach(b => addRow(tbody, b));
  renderCalendar(bookings);
}

// Calendar
function renderCalendar(bookings) {
  const calEl = document.getElementById("calendar");
  if (!calEl) return;
  calEl.innerHTML = ""; // clear existing calendar
  const cal = new FullCalendar.Calendar(calEl, {
    initialView: "dayGridMonth",
    height: "auto",
    events: bookings.map(b => ({
      title: `${b.guestName} (${b.numRooms} ${b.roomType})`,
      start: b.checkIn,
      end: new Date(new Date(b.checkOut).getTime() + 86_400_000).toISOString().slice(0,10),
      allDay: true
    })),
    eventColor: "#ff6f61"
  });
  cal.render();
}

// Utility
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
      if (b.roomType !== type) return sum;
      if (ignoreId && b.id === ignoreId) return sum;
      const d = new Date(date);
      return (d >= new Date(b.checkIn) && d <= new Date(b.checkOut)) ? sum + +b.numRooms : sum;
    }, 0);
    return booked + +num <= (type === "Deluxe" ? 3 : 2);
  });
};

// Sync bookings in real-time
let bookingsList = [];
bookingsRef.onSnapshot(snapshot => {
  bookingsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderBookings(bookingsList);
});

// Form submit
document.getElementById("bookingForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const id = f.editId.value || bookingsRef.doc().id;
  const booking = {
    guestName: f.guestName.value.trim(),
    contactNo: f.contactNo.value.trim(),
    checkIn:   f.checkIn.value,
    checkOut:  f.checkOut.value,
    advance:   f.advance.value,
    numRooms:  f.numRooms.value,
    roomType:  f.roomType.value
  };

  const msg = document.getElementById("entryMessage");
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

// Edit/delete buttons
document.querySelector("#bookingTable tbody").addEventListener("click", e => {
  const row = e.target.closest("tr");
  const id = row.dataset.id;
  const b = bookingsList.find(x => x.id === id);
  if (e.target.classList.contains("delBtn")) {
    if (confirm("Delete this booking?")) bookingsRef.doc(id).delete();
  }
  if (e.target.classList.contains("editBtn")) {
    const f = document.getElementById("bookingForm");
    f.editId.value = id;
    f.guestName.value = b.guestName;
    f.contactNo.value = b.contactNo;
    f.checkIn.value = b.checkIn;
    f.checkOut.value = b.checkOut;
    f.advance.value = b.advance;
    f.numRooms.value = b.numRooms;
    f.roomType.value = b.roomType;
    document.getElementById("submitBtn").textContent = "Update Booking";
    document.querySelector('.tabs li[data-tab="entry"]').click();
  }
});

// Availability checker
document.getElementById("checkAvailability").addEventListener("click", () => {
  const d = document.getElementById("availDate").value;
  if (!d) return;
  const result = ["Deluxe", "Super Deluxe"].map(t => {
    const booked = bookingsList.reduce((sum, b) => {
      if (b.roomType !== t) return sum;
      const cur = new Date(d);
      return (cur >= new Date(b.checkIn) && cur <= new Date(b.checkOut)) ? sum + +b.numRooms : sum;
    }, 0);
    return `${t}: ${(t === "Deluxe" ? 3 : 2) - booked} available`;
  });
  document.getElementById("availabilityResult").textContent = result.join(" | ");
});

// Tab switching
document.querySelectorAll(".tabs li").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelector(".tabs li.active")?.classList.remove("active");
    document.querySelector(".tab.active")?.classList.remove("active");
    tab.classList.add("active");
    const panel = document.getElementById(tab.dataset.tab);
    panel.classList.add("active");
  });
});
