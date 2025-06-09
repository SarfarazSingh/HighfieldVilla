// Enhanced Homestay Booking - script.js (Fixed Billing Module)

// Firebase Firestore reference
const bookingsRef = firebase.firestore().collection("bookings");

let bookingsList = [];

// DOM Elements
const tbody = document.querySelector("#bookingTable tbody");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportCSV");
const summary = document.getElementById("dashboardSummary");

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
  const superLeft = 2 - (occupiedToda‍y["Super Deluxe"] || 0);

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
      end: new Date(new Date(b.checkOut).getTime() + 86400000).toISOString().slice(0, 10),
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

// Booking form submission
const bookingForm = document.getElementById("bookingForm");
if (bookingForm) {
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
}

if (tbody) {
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
}

const checkAvailBtn = document.getElementById("checkAvailability");
const availDate = document.getElementById("availDate");
const availabilityResult = document.getElementById("availabilityResult");

if (checkAvailBtn && availDate && availabilityResult) {
  checkAvailBtn.addEventListener("click", () => {
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
}

// Tab functionality
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll(".tabs li");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelector(".tabs li.active")?.classList.remove("active");
      document.querySelector(".tab.active")?.classList.remove("active");
      tab.classList.add("active");
      const targetTab = document.getElementById(tab.dataset.tab);
      if (targetTab) {
        targetTab.classList.add("active");
      }
    });
  });
});

// Search functionality
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase();
    const filtered = bookingsList.filter(b =>
      b.guestName.toLowerCase().includes(term) ||
      b.roomType.toLowerCase().includes(term) ||
      b.contactNo.includes(term)
    );
    renderBookings(filtered);
  });
}

// Export functionality
if (exportBtn) {
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
}

// FIXED BILLING LOGIC
const initializeBilling = () => {
  const customerSearch = document.getElementById("customerSearch");
  const customerSuggestions = document.getElementById("customerSuggestions");
  const billGuestName = document.getElementById("billGuestName");
  const billContact = document.getElementById("billContact");
  const billRooms = document.getElementById("billRooms");
  const billNights = document.getElementById("billNights");
  const billRate = document.getElementById("billRate");
  const billAdvance = document.getElementById("billAdvance");
  const generateBillBtn = document.getElementById("generateBill");
  const downloadPDFBtn = document.getElementById("downloadPDF");
  const billOutput = document.getElementById("billOutput");

  // Customer search functionality
  if (customerSearch && customerSuggestions) {
    customerSearch.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      customerSuggestions.innerHTML = "";
      
      if (searchTerm.length < 2) {
        customerSuggestions.style.display = "none";
        return;
      }

      const matches = bookingsList.filter(booking => 
        booking.guestName.toLowerCase().includes(searchTerm) ||
        booking.contactNo.includes(searchTerm)
      );

      if (matches.length > 0) {
        customerSuggestions.style.display = "block";
        matches.forEach(booking => {
          const div = document.createElement("div");
          div.className = "suggestion-item";
          div.style.cssText = "padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;";
          div.innerHTML = `<strong>${booking.guestName}</strong> - ${booking.contactNo}`;
          
          div.addEventListener("click", () => {
            // Fill in customer details
            if (billGuestName) billGuestName.value = booking.guestName;
            if (billContact) billContact.value = booking.contactNo;
            if (billAdvance) billAdvance.value = booking.advance || 0;
            
            // Calculate nights between check-in and check-out
            const checkIn = new Date(booking.checkIn);
            const checkOut = new Date(booking.checkOut);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            
            if (billNights) billNights.value = nights;
            if (billRooms) billRooms.value = booking.numRooms;
            
            // Set default room rates
            const defaultRate = booking.roomType === "Super Deluxe" ? 2500 : 2000;
            if (billRate) billRate.value = defaultRate;
            
            customerSearch.value = booking.guestName;
            customerSuggestions.style.display = "none";
          });
          
          customerSuggestions.appendChild(div);
        });
      } else {
        customerSuggestions.style.display = "none";
      }
    });

    // Hide suggestions when clicking outside
    document.addEventListener("click", (e) => {
      if (!customerSearch.contains(e.target) && !customerSuggestions.contains(e.target)) {
        customerSuggestions.style.display = "none";
      }
    });
  }

  // Generate Bill functionality
  if (generateBillBtn && billOutput) {
    generateBillBtn.addEventListener("click", () => {
      const name = billGuestName?.value?.trim() || '';
      const contact = billContact?.value?.trim() || '';
      const rooms = parseInt(billRooms?.value) || 0;
      const nights = parseInt(billNights?.value) || 0;
      const rate = parseFloat(billRate?.value) || 0;
      const advance = parseFloat(billAdvance?.value) || 0;

      // Validation
      if (!name) {
        alert("Please enter guest name");
        return;
      }
      if (rooms <= 0 || nights <= 0 || rate <= 0) {
        alert("Please enter valid numbers for rooms, nights, and rate");
        return;
      }

      const total = rooms * nights * rate;
      const balance = total - advance;
      const currentDate = new Date().toLocaleDateString('en-IN');

      billOutput.innerHTML = `
        <div style="border: 2px solid #333; padding: 20px; background: white; font-family: Arial, sans-serif;">
          <h3 style="text-align: center; margin-bottom: 20px; color: #333;">HIGHFIELD VILLA</h3>
          <h4 style="text-align: center; margin-bottom: 30px; color: #666;">Guest Bill</h4>
          
          <div style="margin-bottom: 20px;">
            <p><strong>Date:</strong> ${currentDate}</p>
            <p><strong>Guest Name:</strong> ${name}</p>
            <p><strong>Contact:</strong> ${contact}</p>
          </div>
          
          <hr style="margin: 20px 0;">
          
          <div style="margin-bottom: 20px;">
            <p><strong>Number of Rooms:</strong> ${rooms}</p>
            <p><strong>Number of Nights:</strong> ${nights}</p>
            <p><strong>Rate per Room per Night:</strong> ₹${rate}</p>
          </div>
          
          <hr style="margin: 20px 0;">
          
          <div style="margin-bottom: 20px;">
            <p><strong>Total Cost:</strong> ₹${total.toFixed(2)}</p>
            <p><strong>Advance Paid:</strong> ₹${advance.toFixed(2)}</p>
            <p style="font-size: 18px; color: ${balance >= 0 ? '#d9534f' : '#5cb85c'};"><strong>
              ${balance >= 0 ? 'Pending Amount' : 'Refund Due'}: ₹${Math.abs(balance).toFixed(2)}
            </strong></p>
          </div>
          
          <hr style="margin: 20px 0;">
          
          <p style="text-align: center; margin-top: 30px; font-style: italic;">
            Thank you for choosing Highfield Villa!
          </p>
        </div>
      `;
      
      billOutput.style.display = "block";
    });
  }

  // Download PDF functionality
  if (downloadPDFBtn && billOutput) {
    downloadPDFBtn.addEventListener("click", () => {
      const content = billOutput.innerHTML;
      if (!content || billOutput.style.display === "none") {
        alert("Please generate the bill first.");
        return;
      }

      const printWindow = window.open("", "_blank", "width=800,height=600");
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Guest Bill - Highfield Villa</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${content}
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()">Print Bill</button>
            <button onclick="window.close()">Close</button>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Auto print after a short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    });
  }
};

// Initialize billing when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeBilling);