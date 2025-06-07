const MAX_ROOMS = {
    'Deluxe': 3,
    'Super Deluxe': 2
};

function loadBookings() {
    return JSON.parse(localStorage.getItem('bookings') || '[]');
}

function saveBookings(bookings) {
    localStorage.setItem('bookings', JSON.stringify(bookings));
}

function addRow(tableBody, booking) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${booking.guestName}</td>
        <td>${booking.contactNo}</td>
        <td>${booking.checkIn}</td>
        <td>${booking.checkOut}</td>
        <td>${booking.numRooms}</td>
        <td>${booking.roomType}</td>
    `;
    tableBody.appendChild(row);
}

function renderBookings() {
    const bookings = loadBookings();
    const tbody = document.querySelector('#bookingTable tbody');
    tbody.innerHTML = '';
    bookings.forEach(b => addRow(tbody, b));
}

function datesBetween(start, end) {
    const dates = [];
    let current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().slice(0,10));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function roomsBookedForDate(date, roomType) {
    const bookings = loadBookings();
    return bookings.reduce((sum, b) => {
        if (b.roomType === roomType) {
            const start = new Date(b.checkIn);
            const end = new Date(b.checkOut);
            const current = new Date(date);
            if (current >= start && current <= end) {
                sum += parseInt(b.numRooms, 10);
            }
        }
        return sum;
    }, 0);
}

function isAvailable(roomType, numRooms, checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const days = datesBetween(start, end);
    for (const day of days) {
        const booked = roomsBookedForDate(day, roomType);
        if (booked + parseInt(numRooms,10) > MAX_ROOMS[roomType]) {
            return false;
        }
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tabs li');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.tabs li.active').classList.remove('active');
            document.querySelector('.tab.active').classList.remove('active');
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    renderBookings();

    document.getElementById('bookingForm').addEventListener('submit', e => {
        e.preventDefault();
        const booking = {
            guestName: document.getElementById('guestName').value.trim(),
            contactNo: document.getElementById('contactNo').value.trim(),
            checkIn: document.getElementById('checkIn').value,
            checkOut: document.getElementById('checkOut').value,
            advance: document.getElementById('advance').value,
            numRooms: document.getElementById('numRooms').value,
            roomType: document.getElementById('roomType').value
        };
        const msg = document.getElementById('entryMessage');
        if (!isAvailable(booking.roomType, booking.numRooms, booking.checkIn, booking.checkOut)) {
            msg.textContent = 'Selected room type not available for chosen dates.';
            return;
        }
        msg.textContent = '';
        const bookings = loadBookings();
        bookings.push(booking);
        saveBookings(bookings);
        renderBookings();
        e.target.reset();
    });

    document.getElementById('checkAvailability').addEventListener('click', () => {
        const date = document.getElementById('availDate').value;
        if (!date) return;
        const result = [];
        for (const type in MAX_ROOMS) {
            const booked = roomsBookedForDate(date, type);
            result.push(`${type}: ${MAX_ROOMS[type] - booked} available`);
        }
        document.getElementById('availabilityResult').textContent = result.join(' | ');
    });
});
