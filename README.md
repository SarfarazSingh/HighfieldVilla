# Highfield Villa Booking Webapp

This simple client-side webapp lets you manage homestay room bookings. No backend server is required; all data is stored in your browser's local storage.

## Usage

1. Open `webapp/index.html` in a modern web browser.
2. Use the **Booking Entry** tab to add reservations. The app prevents double
   booking of rooms if availability is exceeded (3 Deluxe, 2 Super Deluxe).
3. Switch to the **Room Availability** tab to check how many rooms are free on
   a selected date.

Existing bookings are shown in a table on the entry page. Data persists in your
browser until local storage is cleared.
