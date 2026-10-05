# Changelog

Releases are git tags; consumers pin `github:laurenthh/rn-lookup-kit#vX.Y.Z`.

## 1.1.0

Link builders for apps that already hold structured records (travel-copilot's
hotels and flight segments). No behaviour change to any lookup; corpora
unchanged.

- Root: `bookingSearchLink({ query, checkIn, checkOut, adults?, children?, rooms? })`
  and `flightsSearchLink({ to, from?, date?, adults? })`, returning
  `string | null`, with their types `BookingSearch`, `FlightSearch`,
  `StayParty`. Their output is exactly what `lookupLinkKind` recognises as
  `booking` / `flights`; the travel lookup now builds those links through
  the same code.
- `/travel`: `airportFor(code)` (the IATA table, any case) and
  `airportCity(field)` (a city only for a leading upper-case code, as the
  travel lookup's airport note line reads it).
- README "Link builders" section, type-checked like the usage example.

## 1.0.0

First release: `/travel`, `/dining`, `/food`, `/exercise` lookups extracted
from checklist-copilot.
