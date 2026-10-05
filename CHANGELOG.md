# Changelog

Releases are git tags; consumers pin `github:laurenthh/rn-lookup-kit#vX.Y.Z`.

## 1.2.0

A chrono-free `rn-lookup-kit/airports` entry, so an app that only wants the
airport lookup no longer bundles `/travel` (about +518 KB minified in
travel-copilot, mostly the dining and place parsers and chrono-node).
Additive: nothing changes for existing imports, corpora unchanged.

- New entry `rn-lookup-kit/airports`: `airportFor`, `airportCity`. Its import
  graph is the airport table plus one import-free date-word list; no
  chrono-node, no dining, no travel code (tested on the built `dist`).
- `/travel` still exports both, the same functions.
- Internal: `airportCity` moved to `places/airports`, `DATE_WORDS` to
  `places/dateWords`.

## 1.1.0

Link builders for apps that already hold structured records (travel-copilot's
hotels and flight segments). No behaviour change to any lookup; corpora
unchanged.

- Root: `bookingSearchLink({ query, checkIn, checkOut, adults?, children?, rooms? })`
  and `flightsSearchLink({ to, from?, date?, adults? })`, returning
  `string | null` and never throwing; every text field may be `null` /
  `undefined`. Types `BookingSearch`, `FlightSearch`, `StayParty`. Their
  output is exactly what `lookupLinkKind` recognises as `booking` /
  `flights`. The party keeps Booking.com's limits (30 people, 10 children,
  at least one adult per room) or falls back to the default party.
- Shared with the travel lookup: the Booking.com stay query and default
  party, the Google Flights `q=` text, and (new `core/stay`) the 30-people /
  10-children / 30-nights limits and the day maths the booking-line parser
  uses. The lookup still assembles its own Booking.com search URL and
  flights URL around those (its inputs are already bounded); its output is
  byte-identical to 1.0.0.
- `/travel`: `airportFor(code)` (the IATA table, any case) and
  `airportCity(field)` (a city only for a leading upper-case code, as the
  travel lookup's airport note line reads it; `null` / `undefined` give
  null).
- README "Link builders" section, type-checked like the usage example.

## 1.0.0

First release: `/travel`, `/dining`, `/food`, `/exercise` lookups extracted
from checklist-copilot.
