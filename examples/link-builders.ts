import { bookingSearchLink, flightsSearchLink } from 'rn-lookup-kit'
import { airportCity } from 'rn-lookup-kit/airports'

// A hotel record: Booking.com's search on its nights, for the party.
const hotelLink = bookingSearchLink({
  query: 'W Osaka, Osaka',
  checkIn: '2026-10-20', // local days, YYYY-MM-DD
  checkOut: '2026-10-25',
  adults: 2, // optional: 2 adults, 1 room, no children by default
})
// → https://www.booking.com/searchresults.html?ss=W%20Osaka%2C%20Osaka&checkin=2026-10-20&…
//   null without a query, or unless checkOut is 1–30 nights after checkIn

// A flight segment: Google Flights, with the date spelled out in `q=`.
const flightLink = flightsSearchLink({
  from: 'SYD',
  to: 'KIX',
  date: '2026-10-20', // optional, like adults; a bad value is left out
  adults: 2,
})
// → https://www.google.com/travel/flights?q=flights%20from%20SYD%20to%20KIX%20on%2020%20Oct%202026%20for%202%20adults

// The city under a code; null for "Osaka", "Kyoto Station", "bus".
const cityLabel = airportCity('KIX') // 'Osaka'

export { cityLabel, flightLink, hotelLink }
