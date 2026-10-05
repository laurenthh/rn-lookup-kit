// A weekday/month word, shared by the transport parser's flight-number
// check and the airport-code boundary check (airports.ts). Kept import-free
// so the `airports` entry never reaches the transport/travel code. transport.ts
// adds a trailing `[a-z]*` ("Monday", "January"); airports.ts uses them bare.
export const DATE_WORDS =
  'mon|tue|wed|thu|fri|sat|sun|' +
  'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'
