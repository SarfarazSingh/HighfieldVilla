// Enhanced Homestay Booking - script.js (Professional Invoice Module)

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
  for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1))
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
      const checkout = new Date(b.checkOut);
      checkout.setDate(checkout.getDate() - 1);
      return (d >= new Date(b.checkIn) && d <= checkout) ? sum + +b.numRooms : sum;
    }, 0);
    return booked + +num <= (type === "Deluxe" ? 3 : 2);
  });
};

const updateSummary = () => {
  const total = bookingsList.length;
  const advance = bookingsList.reduce((sum, b) => sum + Number(b.advance), 0);
  const today = new Date().toISOString().slice(0, 10);
  const occupiedToday = bookingsList.filter(b => {
    const co = new Date(b.checkOut);
    co.setDate(co.getDate() - 1);
    return today >= b.checkIn && today <= co;
  })
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
    if (!d) {
      availabilityResult.innerHTML = '<span style="color: #e74c3c;">Please select a date first</span>';
      return;
    }
    
    const selectedDate = new Date(d);
    const result = ["Deluxe", "Super Deluxe"].map(t => {
      const booked = bookingsList.reduce((sum, b) => {
        if (b.roomType !== t) return sum;
        const checkIn = new Date(b.checkIn);
        const checkOut = new Date(b.checkOut);
        checkOut.setDate(checkOut.getDate() - 1);
        // Check if selected date falls within booking period
        return (selectedDate >= checkIn && selectedDate <= checkOut) ? sum + parseInt(b.numRooms) : sum;
      }, 0);
      const available = (t === "Deluxe" ? 3 : 2) - booked;
      return `<span style="color: ${available > 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">${t}: ${available} available</span>`;
    });
    
    availabilityResult.innerHTML = `
      <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db; margin-top: 10px;">
        <strong>Availability for ${selectedDate.toLocaleDateString('en-IN')}:</strong><br>
        ${result.join(' | ')}
      </div>
    `;
     availabilityResult.style.display = "block"; 
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

// PROFESSIONAL INVOICE BILLING LOGIC
const initializeBilling = () => {
  const customerSearch = document.getElementById("customerSearch");
  const customerSuggestions = document.getElementById("customerSuggestions");
  const billGuestName = document.getElementById("billGuestName");
  const billContact = document.getElementById("billContact");
  const billRooms = document.getElementById("billRooms");
  const billNights = document.getElementById("billNights");
  const billRate = document.getElementById("billRate");
  const billAdvance = document.getElementById("billAdvance");
  const billMisc = document.getElementById("billMisc");
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
          div.style.cssText = "padding: 12px; cursor: pointer; border-bottom: 1px solid #e0e0e0; transition: background-color 0.2s;";
          div.innerHTML = `<strong style="color: #2c3e50;">${booking.guestName}</strong><br><small style="color: #7f8c8d;">${booking.contactNo}</small>`;
          
          div.addEventListener("mouseenter", () => {
            div.style.backgroundColor = "#f8f9fa";
          });
          
          div.addEventListener("mouseleave", () => {
            div.style.backgroundColor = "white";
          });
          
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
            const defaultRate = booking.roomType === "Super Deluxe" ? 6500 : 5000;
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

  // Generate Professional Invoice functionality
  if (generateBillBtn && billOutput) {
    generateBillBtn.addEventListener("click", () => {
      const name = billGuestName?.value?.trim() || '';
      const contact = billContact?.value?.trim() || '';
      const rooms = parseInt(billRooms?.value) || 0;
      const nights = parseInt(billNights?.value) || 0;
      const rate = parseFloat(billRate?.value) || 0;
      const advance = parseFloat(billAdvance?.value) || 0;
      const misc = parseFloat(billMisc?.value) || 0;

      // Find booking details for check-in/check-out dates
      const booking = bookingsList.find(b => 
        b.guestName.toLowerCase() === name.toLowerCase() || 
        b.contactNo === contact
      );

      // Validation
      if (!name) {
        alert("Please enter guest name");
        return;
      }
      if (rooms <= 0 || nights <= 0 || rate <= 0) {
        alert("Please enter valid numbers for rooms, nights, and rate");
        return;
      }

      const tariff = rooms * nights * rate;
      const total = tariff + misc;
      const balance = total - advance;
      const currentDate = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const invoiceNumber = 'HV' + Date.now().toString().slice(-8);

      billOutput.innerHTML = `
        <div style="
          max-width: 800px;
          margin: 0 auto;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2px;
          border-radius: 15px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        ">
          <div style="
            background: white;
            border-radius: 13px;
            padding: 40px;
            position: relative;
            overflow: hidden;
          ">
            <!-- Header Section -->
            <div style="
              text-align: center;
              margin-bottom: 40px;
              position: relative;
            ">
              <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 8px;
                letter-spacing: 2px;
              ">
                HIGHFIELD VILLA
              </div>
              <div style="
                color: #7f8c8d;
                font-size: 16px;
                margin-bottom: 20px;
                font-weight: 300;
              ">
                Premium Homestay Experience
              </div>
              <div style="
                background: linear-gradient(90deg, #667eea, #764ba2);
                height: 3px;
                width: 100px;
                margin: 0 auto;
                border-radius: 2px;
              "></div>
            </div>

            <!-- Invoice Title -->
            <div style="
              text-align: center;
              margin-bottom: 40px;
            ">
              <h2 style="
                color: #2c3e50;
                font-size: 28px;
                margin: 0;
                font-weight: 600;
                letter-spacing: 1px;
              ">CUSTOMER INVOICE</h2>
              <div style="
                color: #7f8c8d;
                font-size: 14px;
                margin-top: 8px;
              ">
                Invoice #${invoiceNumber} | Date: ${currentDate}
              </div>
            </div>

            <!-- Guest Information Card -->
            <div style="
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-radius: 12px;
              padding: 25px;
              margin-bottom: 30px;
              border-left: 5px solid #667eea;
            ">
              <h3 style="
                color: #2c3e50;
                margin: 0 0 20px 0;
                font-size: 18px;
                font-weight: 600;
              ">Guest Information</h3>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                  <div style="color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Guest Name</div>
                  <div style="color: #2c3e50; font-size: 16px; font-weight: 600;">${name}</div>
                </div>
                <div>
                  <div style="color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Contact Number</div>
                  <div style="color: #2c3e50; font-size: 16px; font-weight: 600;">${contact}</div>
                </div>
              </div>
            </div>

            <!-- Booking Details Grid -->
            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-bottom: 30px;
            ">
              <div style="
                background: white;
                border: 2px solid #e9ecef;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
                transition: transform 0.2s;
              ">
                <div style="color: #667eea; font-size: 24px; font-weight: bold; margin-bottom: 8px;">${rooms}</div>
                <div style="color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Rooms Booked</div>
              </div>
              
              <div style="
                background: white;
                border: 2px solid #e9ecef;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
              ">
                <div style="color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 8px;">${booking ? new Date(booking.checkIn).toLocaleDateString('en-IN') : 'N/A'}</div>
                <div style="color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Check In Date</div>
              </div>
              
              <div style="
                background: white;
                border: 2px solid #e9ecef;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
              ">
                <div style="color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 8px;">${booking ? new Date(booking.checkOut).toLocaleDateString('en-IN') : 'N/A'}</div>
                <div style="color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Check Out Date</div>
              </div>
            </div>

            <!-- Billing Summary -->
            <div style="
              background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
              color: white;
              border-radius: 12px;
              padding: 30px;
              margin-bottom: 30px;
            ">
              <h3 style="
                margin: 0 0 25px 0;
                font-size: 20px;
                font-weight: 600;
                text-align: center;
              ">Billing Summary</h3>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <span style="font-size: 16px;">Room Rate (per night)</span>
                <span style="font-size: 16px; font-weight: 600;">₹${rate.toLocaleString('en-IN')}</span>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <span style="font-size: 16px;">Total Nights</span>
                <span style="font-size: 16px; font-weight: 600;">${nights}</span>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <span style="font-size: 16px;">Misc. Charges</span>
                <span style="font-size: 16px; font-weight: 600;">₹${misc.toLocaleString('en-IN')}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid rgba(255,255,255,0.3);">
                <span style="font-size: 18px; font-weight: 600;">Total Tariff</span>
                <span style="font-size: 20px; font-weight: bold;">₹${tariff.toLocaleString('en-IN')}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid rgba(255,255,255,0.3);">
                <span style="font-size: 18px; font-weight: 600;">Grand Total</span>
                <span style="font-size: 20px; font-weight: bold;">₹${total.toLocaleString('en-IN')}</span>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 16px;">Advance Paid</span>
                <span style="font-size: 16px; font-weight: 600;">₹${advance.toLocaleString('en-IN')}</span>
              </div>
              
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
              ">
                <span style="font-size: 20px; font-weight: bold;">
                  ${balance >= 0 ? 'Amount to be Paid' : 'Refund Due'}
                </span>
                <span style="
                  font-size: 24px;
                  font-weight: bold;
                  color: ${balance >= 0 ? '#e74c3c' : '#2ecc71'};
                ">
                  ₹${Math.abs(balance).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <!-- Thank You Message -->
            <div style="
              text-align: center;
              padding: 25px;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-radius: 12px;
              margin-bottom: 30px;
            ">
              <p style="
                color: #2c3e50;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 15px 0;
              ">
                We hope you had a pleasant stay at Highfield Villa. Thank you for choosing us.<br>
                We look forward to welcoming you again soon!
              </p>
              <div style="
                color: #7f8c8d;
                font-size: 14px;
                margin-top: 15px;
              ">
                For any queries or future bookings, contact us at <strong>+91-8427228937</strong><br>
                Visit <strong>www.highfieldvilla.com</strong>
              </div>
            </div>

            <!-- Signatures Section -->
            <div style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 40px;
              padding-top: 30px;
              border-top: 2px solid #e9ecef;
            ">
              <div style="text-align: center;">
                <div style="
                  border-bottom: 2px solid #2c3e50;
                  width: 200px;
                  margin: 0 auto 10px auto;
                  height: 40px;
                "></div>
                <div style="
                  color: #7f8c8d;
                  font-size: 14px;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                ">Guest Signature</div>
              </div>
              
              <div style="text-align: center;">
                <div style="
                  border-bottom: 2px solid #2c3e50;
                  width: 200px;
                  margin: 0 auto 10px auto;
                  height: 40px;
                "></div>
                <div style="
                  color: #7f8c8d;
                  font-size: 14px;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                ">Manager Signature</div>
              </div>
            </div>

            <!-- Decorative Elements -->
            <div style="
              position: absolute;
              top: -50px;
              right: -50px;
              width: 100px;
              height: 100px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              opacity: 0.1;
              border-radius: 50%;
            "></div>
            
            <div style="
              position: absolute;
              bottom: -30px;
              left: -30px;
              width: 60px;
              height: 60px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              opacity: 0.1;
              border-radius: 50%;
            "></div>
          </div>
        </div>
      `;
      
      billOutput.style.display = "block";
    });
  }

  // Download Image functionality with html2canvas
  if (downloadPDFBtn && billOutput) {
    downloadPDFBtn.addEventListener("click", () => {
      const content = billOutput.innerHTML;
      if (!content || billOutput.style.display === "none") {
        alert("Please generate the invoice first.");
        return;
      }

      // Create a temporary div for capturing
      const captureDiv = document.createElement('div');
      captureDiv.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 800px;
        background: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      `;
      captureDiv.innerHTML = content;
      document.body.appendChild(captureDiv);

      // Use html2canvas if available, otherwise fallback to simple method
      if (typeof html2canvas !== 'undefined') {
        html2canvas(captureDiv, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          width: 800,
          height: captureDiv.scrollHeight
        }).then(canvas => {
          // Create download link
          const link = document.createElement('a');
          link.download = `Highfield_Villa_Invoice_${Date.now()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          
          // Clean up
          document.body.removeChild(captureDiv);
        }).catch(error => {
          console.error('Error generating image:', error);
          // Fallback to window method
          openInvoiceWindow(content);
          document.body.removeChild(captureDiv);
        });
      } else {
        // Fallback method - open in new window
        openInvoiceWindow(content);
        document.body.removeChild(captureDiv);
      }
    });
  }

  // Helper function to open invoice in new window
  function openInvoiceWindow(content) {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Invoice - Highfield Villa</title>
        <meta charset="UTF-8">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
          }
          .download-section {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: transform 0.2s;
          }
          .btn:hover {
            transform: translateY(-2px);
          }
          .btn-secondary {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
          }
        </style>
      </head>
      <body>
        <div id="invoice-content">
          ${content}
        </div>
        <div class="download-section">
          <button class="btn" onclick="downloadAsImage()">📥 Download as Image</button>
          <button class="btn btn-secondary" onclick="window.close()">✖️ Close Window</button>
        </div>
        
        <script>
          function downloadAsImage() {
            const element = document.getElementById('invoice-content');
            if (typeof html2canvas !== 'undefined') {
              html2canvas(element, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true
              }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'Highfield_Villa_Invoice_' + Date.now() + '.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
              }).catch(error => {
                alert('Error generating image. Please try right-clicking on the invoice and select "Save as PDF" instead.');
              });
            } else {
              alert('Image download not available. Please right-click on the invoice and select "Save as PDF".');
            }
          }
        </script>
      </body>
      </html>
    `);
    
  printWindow.document.close();
  printWindow.focus();
}
};

const initializeVoucher = () => {
  const search = document.getElementById('voucherCustomerSearch');
  const suggestions = document.getElementById('voucherCustomerSuggestions');
  const nameField = document.getElementById('voucherGuestName');
  const contactField = document.getElementById('voucherContact');
  const checkInField = document.getElementById('voucherCheckIn');
  const checkOutField = document.getElementById('voucherCheckOut');
  const nightsField = document.getElementById('voucherNights');
  const guestsField = document.getElementById('voucherGuests');
  const roomsField = document.getElementById('voucherRooms');
  const extraField = document.getElementById('voucherExtra');
  const accomField = document.getElementById('voucherAccommodation');
  const extraChargeField = document.getElementById('voucherExtraCharge');
  const advanceField = document.getElementById('voucherAdvance');
  const additionalField = document.getElementById('voucherAdditional');
  const generateBtn = document.getElementById('generateVoucher');
  const downloadBtn = document.getElementById('downloadVoucher');
  const output = document.getElementById('voucherOutput');

  if (search && suggestions) {
    search.addEventListener('input', e => {
      const term = e.target.value.toLowerCase().trim();
      suggestions.innerHTML = '';
      if (term.length < 2) {
        suggestions.style.display = 'none';
        return;
      }
      const matches = bookingsList.filter(b =>
        b.guestName.toLowerCase().includes(term) || b.contactNo.includes(term)
      );
      if (matches.length) {
        suggestions.style.display = 'block';
        matches.forEach(b => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          div.textContent = `${b.guestName} (${b.contactNo})`;
          div.addEventListener('click', () => {
            nameField.value = b.guestName;
            contactField.value = b.contactNo;
            checkInField.value = b.checkIn;
            checkOutField.value = b.checkOut;
            nightsField.value = Math.ceil((new Date(b.checkOut) - new Date(b.checkIn)) / 86400000);
            roomsField.value = `${b.numRooms} ${b.roomType}`;
            advanceField.value = b.advance || 0;
            search.value = b.guestName;
            suggestions.style.display = 'none';
          });
          suggestions.appendChild(div);
        });
      } else {
        suggestions.style.display = 'none';
      }
    });

    document.addEventListener('click', e => {
      if (!search.contains(e.target) && !suggestions.contains(e.target)) {
        suggestions.style.display = 'none';
      }
    });
  }

  if (generateBtn && output) {
    generateBtn.addEventListener('click', () => {
      const name = nameField.value.trim();
      if (!name) {
        alert('Please enter guest name');
        return;
      }
      const ci = checkInField.value;
      const co = checkOutField.value;
      let nights = parseInt(nightsField.value, 10);
      if (!nights && ci && co) {
        nights = Math.ceil((new Date(co) - new Date(ci)) / 86400000);
      }
      const contact = contactField.value.trim();
      const rooms = roomsField.value.trim();
      const guests = guestsField.value.trim();
      const extra = extraField.value.trim();
      const accom = parseFloat(accomField.value) || 0;
      const extraCharge = parseFloat(extraChargeField.value) || 0;
      const advance = parseFloat(advanceField.value) || 0;
      const additional = additionalField.value.trim();

      const total = accom + extraCharge;
      const pending = total - advance;

      const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

      output.innerHTML = `
        <div style="max-width:800px;margin:0 auto;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:2px;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.1);font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="background:white;border-radius:13px;padding:40px;position:relative;">
            <div style="text-align:center;margin-bottom:30px;">
              <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:32px;font-weight:bold;margin-bottom:8px;letter-spacing:2px;">HIGHFIELD VILLA</div>
              <div style="color:#7f8c8d;font-size:16px;margin-bottom:20px;font-weight:300;">Peaceful Getaway in the Hills</div>
              <div style="background:linear-gradient(90deg,#667eea,#764ba2);height:3px;width:100px;margin:0 auto;border-radius:2px;"></div>
            </div>
            <h2 style="text-align:center;color:#2c3e50;margin-bottom:30px;font-size:24px;font-weight:600;">BOOKING VOUCHER for ${name}</h2>

            <div style="margin-bottom:20px;">
              <h3 style="color:#2c3e50;margin-bottom:5px;">Booking Dates</h3>
              <p style="margin:0;color:#2c3e50;">Check-in: ${formatDate(ci)}</p>
              <p style="margin:0;color:#2c3e50;">Check-out: ${formatDate(co)}</p>
              <p style="margin:0;color:#2c3e50;">Duration: ${nights || ''} Night${nights==1?'':'s'}</p>
            </div>

            <div style="margin-bottom:20px;">
              <h3 style="color:#2c3e50;margin-bottom:5px;">Guest Details</h3>
              <p style="margin:0;color:#2c3e50;">Guest Name: ${name}</p>
              <p style="margin:0;color:#2c3e50;">Contact No.: ${contact || 'N/A'}</p>
              ${guests ? `<p style="margin:0;color:#2c3e50;">Total Guests: ${guests}</p>` : ''}
              ${rooms ? `<p style="margin:0;color:#2c3e50;">Rooms Booked: ${rooms}</p>` : ''}
              ${extra ? `<p style="margin:0;color:#2c3e50;">Extra Bedding: ${extra}</p>` : ''}
            </div>

            <div style="margin-bottom:20px;">
              <h3 style="color:#2c3e50;margin-bottom:5px;">Tariff Details</h3>
              <p style="margin:0;color:#2c3e50;">Accommodation: ₹${accom.toLocaleString('en-IN')}</p>
              <p style="margin:0;color:#2c3e50;">Extra Bedding: ₹${extraCharge.toLocaleString('en-IN')}</p>
              <p style="margin:0;color:#2c3e50;">Total Amount: ₹${total.toLocaleString('en-IN')}</p>
              <p style="margin:0;color:#2c3e50;">Advance Paid: ₹${advance.toLocaleString('en-IN')}</p>
              <p style="margin:0;color:#2c3e50;">Pending Amount: ₹${pending.toLocaleString('en-IN')}</p>
            </div>

            <div style="margin-bottom:20px;">
              <h3 style="color:#2c3e50;margin-bottom:5px;">Pet Policy</h3>
              <p style="margin:0;color:#2c3e50;">Pets allowed at no extra charge</p>
            </div>
            
            <div style="margin-bottom:20px;">
              <h3 style="color:#2c3e50;margin-bottom:5px;">Child Charges</h3>
              <p style="margin:0;color:#2c3e50;">
              Children above the age of 10 years to be considered as adults and to be counted towards booking of room.
            </p>
            </div>

            <div style="margin-bottom:20px;">
              <h3 style="color:#2c3e50;margin-bottom:5px;">Bonfire (optional)</h3>
              <p style="margin:0;color:#2c3e50;">Available on request @ ₹1,000 per session</p>
            </div>

            ${additional ? `<div style="margin-bottom:20px;color:#2c3e50;">${additional}</div>` : ''}

            <div style="text-align:center;margin-top:30px;">
              <p style="margin:0;color:#2c3e50;">🏡 Highfield Villa</p>
              <p style="margin:0;color:#2c3e50;">📍 https://maps.app.goo.gl/5MAC3Hr4zGiajSPR9</p>
              <p style="margin:0;color:#2c3e50;">📞 8427228937</p>
            </div>
          </div>
        </div>`;

      output.style.display = 'block';
    });
  }

  if (downloadBtn && output) {
    downloadBtn.addEventListener('click', () => {
      const content = output.innerHTML;
      if (!content || output.style.display === 'none') {
        alert('Please generate the voucher first.');
        return;
      }
      const captureDiv = document.createElement('div');
      captureDiv.style.cssText = `position: fixed; top: -9999px; left: -9999px; width: 800px; background: white;`;
      captureDiv.innerHTML = content;
      document.body.appendChild(captureDiv);

      if (typeof html2canvas !== 'undefined') {
        html2canvas(captureDiv, { backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: true, width: 800, height: captureDiv.scrollHeight })
          .then(canvas => {
            const link = document.createElement('a');
            link.download = `Highfield_Villa_Voucher_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(captureDiv);
          })
          .catch(() => {
            openVoucherWindow(content);
            document.body.removeChild(captureDiv);
          });
      } else {
        openVoucherWindow(content);
        document.body.removeChild(captureDiv);
      }
    });
  }

  function openVoucherWindow(content) {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Booking Voucher - Highfield Villa</title><meta charset="UTF-8"><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script></head><body>
      <div id="voucher-content">${content}</div>
      <div style="text-align:center;margin:20px 0;"><button onclick="downloadImg()" style="padding:12px 24px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:6px;cursor:pointer;margin-right:10px;">Download as Image</button><button onclick="window.close()" style="padding:12px 24px;background:linear-gradient(135deg,#95a5a6 0%,#7f8c8d 100%);color:white;border:none;border-radius:6px;cursor:pointer;">Close Window</button></div>
      <script>function downloadImg(){const el=document.getElementById('voucher-content');html2canvas(el,{backgroundColor:'#ffffff',scale:2,useCORS:true,allowTaint:true}).then(c=>{const a=document.createElement('a');a.download='Highfield_Villa_Voucher_'+Date.now()+'.png';a.href=c.toDataURL('image/png');a.click();});}</script>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
  }
};

// Initialize billing when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeBilling();
  initializeVoucher();
});
