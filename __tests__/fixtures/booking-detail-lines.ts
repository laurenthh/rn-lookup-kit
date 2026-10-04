import type { BookingDetails } from '../../src/travel/details'

// Booking-details corpus: the Gardener's 60 hotel lines (2026-10-04), the
// relative forms, and the stage-2 review lines. Each line has the expected
// details at FIRST_REFERENCE and, when they differ, at SECOND_REFERENCE.
// Ambiguous numerics read day-first; a single date is one night; vague, past
// or unreadable dates give none. Taps are off noon on purpose (chrono turns
// weekdays over at 12:00).
export const FIRST_REFERENCE = new Date(2026, 9, 4, 18, 30)
export const SECOND_REFERENCE = new Date(2027, 2, 15, 8, 15)

export type DetailLine = [
  text: string,
  atFirst: BookingDetails | null,
  atSecond?: BookingDetails | null,
]

type Typed = Partial<Pick<BookingDetails, 'adults' | 'children' | 'rooms'>>

const party = ({
  adults = null,
  children = null,
  rooms = null,
}: Typed): BookingDetails => ({ dates: null, adults, children, rooms })

const stay = (
  checkIn: string,
  checkOut: string,
  typed: Typed = {},
): BookingDetails => ({ ...party(typed), dates: { checkIn, checkOut } })

const NONE = null

export const HOTEL_DETAIL_LINES: DetailLine[] = [
  [
    'book hotel in madarao for 20-02-2027',
    stay('2027-02-20', '2027-02-21'),
    NONE,
  ],
  [
    'book hotel osaka 20 to 25 oct',
    stay('2026-10-20', '2026-10-25'),
    stay('2027-10-20', '2027-10-25'),
  ],
  [
    'book hotel in rome for 2 ppl 25 jan 2028',
    stay('2028-01-25', '2028-01-26', { adults: 2 }),
  ],
  [
    'Book hotel Lisbon 20-25/10',
    stay('2026-10-20', '2026-10-25'),
    stay('2027-10-20', '2027-10-25'),
  ],
  [
    'Hotel Osaka Oct 20–25',
    stay('2026-10-20', '2026-10-25'),
    stay('2027-10-20', '2027-10-25'),
  ],
  [
    'Book hotel in Kyoto from 20 oct for 3 nights',
    stay('2026-10-20', '2026-10-23'),
    stay('2027-10-20', '2027-10-23'),
  ],
  [
    'Hotel Porto 3 nights from Fri',
    stay('2026-10-09', '2026-10-12'),
    stay('2027-03-19', '2027-03-22'),
  ],
  // ambiguous: read day-first
  [
    'Book hotel Berlin 12/10',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  // ambiguous: read day-first
  ['Book hotel Berlin 10/12/2026', stay('2026-12-10', '2026-12-11'), NONE],
  ['Book hotel Berlin 2026-12-10', stay('2026-12-10', '2026-12-11'), NONE],
  [
    'Hotel in Nara 14 Feb',
    stay('2027-02-14', '2027-02-15'),
    // 29 days past at the second reference: a slip, not next year.
    NONE,
  ],
  [
    'Book ryokan Hakone 14th–16th March',
    stay('2027-03-14', '2027-03-16'),
    NONE,
  ],
  [
    'Hotel Tokyo Fri–Sun',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-03-19', '2027-03-21'),
  ],
  [
    'Book hotel in Osaka Friday to Sunday',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-03-19', '2027-03-21'),
  ],
  // vague: no dates wanted
  ['Hostel Lisbon next weekend', NONE],
  [
    'Hotel in Paris 24.12.2026 - 27.12.2026',
    stay('2026-12-24', '2026-12-27'),
    NONE,
  ],
  [
    'Book hotel Zürich 3-5 Jan',
    stay('2027-01-03', '2027-01-05'),
    stay('2028-01-03', '2028-01-05'),
  ],
  [
    'Book hotel in Madrid Dec 31 – Jan 2',
    stay('2026-12-31', '2027-01-02'),
    stay('2027-12-31', '2028-01-02'),
  ],
  [
    'Hotel Bangkok 20/10-25/10',
    stay('2026-10-20', '2026-10-25'),
    stay('2027-10-20', '2027-10-25'),
  ],
  ['Hotel Madarao 20.02.27', stay('2027-02-20', '2027-02-21'), NONE],
  // vague: no dates wanted
  ['Book hotel in Rome early June', NONE],
  // week number: no dates wanted
  ['Book hotel Oslo wk 42', NONE],
  [
    'Hotel Kyoto 2 nights 12 Oct',
    stay('2026-10-12', '2026-10-14'),
    stay('2027-10-12', '2027-10-14'),
  ],
  [
    'Hotel in Milan tonight',
    stay('2026-10-04', '2026-10-05'),
    stay('2027-03-15', '2027-03-16'),
  ],
  [
    'Book hotel tomorrow night Birmingham',
    stay('2026-10-05', '2026-10-06'),
    stay('2027-03-16', '2027-03-17'),
  ],
  [
    'book hotel in madarao 20-02-2027 to 23-02-2027',
    stay('2027-02-20', '2027-02-23'),
    NONE,
  ],
  ['Book hotel Rome 2 ppl', party({ adults: 2 })],
  ['Hotel Osaka for 2', party({ adults: 2 })],
  ['Book hotel Seville 2 adults 1 child', party({ adults: 2, children: 1 })],
  // adults/children split unknown
  ['Hotel Lisbon family of 4', party({ adults: 4 })],
  [
    'Book 2 rooms Hilton Osaka 12–14 Oct',
    stay('2026-10-12', '2026-10-14', { rooms: 2 }),
    stay('2027-10-12', '2027-10-14', { rooms: 2 }),
  ],
  [
    'Hotel Nice 2 adults 2 kids (ages 5 and 8)',
    party({ adults: 2, children: 2 }),
  ],
  ['Book hotel in Bali for 6 people 3 rooms', party({ adults: 6, rooms: 3 })],
  ['Hotel Barcelona 4 pax', party({ adults: 4 })],
  [
    'Book hotel for 2 adults Lisbon 20-23 Oct',
    stay('2026-10-20', '2026-10-23', { adults: 2 }),
    stay('2027-10-20', '2027-10-23', { adults: 2 }),
  ],
  ['Hotel Edinburgh 1 person 3 nights', party({ adults: 1 })],
  [
    'Twin room Hotel Granvia Kyoto 12 Oct',
    stay('2026-10-12', '2026-10-13', { rooms: 1 }),
    stay('2027-10-12', '2027-10-13', { rooms: 1 }),
  ],
  [
    'Book family room Hotel Sol Pelícanos 1–8 Aug',
    stay('2027-08-01', '2027-08-08', { rooms: 1 }),
  ],
  // a time, not a date
  ['Hotel Granvia Kyoto 15:00', NONE],
  [
    'Check in to Hilton 3pm 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  // a name
  ['Hotel Friday', NONE],
  // no month: no dates wanted
  ['Hotel Osaka 20 - 25', NONE],
  [
    'Book hotel Rome 25/1',
    stay('2027-01-25', '2027-01-26'),
    stay('2028-01-25', '2028-01-26'),
  ],
  [
    'Book hotel in Osaka Oct 12–15',
    stay('2026-10-12', '2026-10-15'),
    stay('2027-10-12', '2027-10-15'),
  ],
  [
    'Hotel Sydney NYE 31 Dec - 2 Jan 2 adults',
    stay('2026-12-31', '2027-01-02', { adults: 2 }),
    stay('2027-12-31', '2028-01-02', { adults: 2 }),
  ],
  [
    'Book hotel Nagano 20/2/27 - 23/2/27',
    stay('2027-02-20', '2027-02-23'),
    NONE,
  ],
  [
    'Book hotel Munich Oktoberfest 19.09.2027',
    stay('2027-09-19', '2027-09-20'),
  ],
  [
    'Hotel Vienna 2 nights 24-26 Dec',
    stay('2026-12-24', '2026-12-26'),
    stay('2027-12-24', '2027-12-26'),
  ],
  [
    'Hotel Prague 4 nights from 3 March',
    stay('2027-03-03', '2027-03-07'),
    NONE,
  ],
  [
    'Book hotel Amsterdam 1 night Sat',
    stay('2026-10-10', '2026-10-11'),
    stay('2027-03-20', '2027-03-21'),
  ],
  [
    'Book hotel in Rome for 2 ppl 25 jan 2028 3 nights',
    stay('2028-01-25', '2028-01-28', { adults: 2 }),
  ],
  // ambiguous: read day-first
  [
    'Hotel Hanoi 02/11 – 05/11 2 adults',
    stay('2026-11-02', '2026-11-05', { adults: 2 }),
    stay('2027-11-02', '2027-11-05', { adults: 2 }),
  ],
  ['Book hotel Bergen Jun 30–Jul 2', stay('2027-06-30', '2027-07-02')],
  // no month: no dates wanted
  ['Hotel Osaka 20th-25th', NONE],
  [
    'Book hotel in Rome 25 jan',
    stay('2027-01-25', '2027-01-26'),
    stay('2028-01-25', '2028-01-26'),
  ],
  [
    'Hotel Kyoto 11/11',
    stay('2026-11-11', '2026-11-12'),
    stay('2027-11-11', '2027-11-12'),
  ],
  [
    'Book hotel in Madarao Feb 20-23 2027 2 adults 1 child',
    stay('2027-02-20', '2027-02-23', { adults: 2, children: 1 }),
    party({ adults: 2, children: 1 }),
  ],
  ['Hotel Rome 3 nights', NONE],
  // 36 nights: past Booking.com's 30-night cap.
  ['Book hotel Osaka Oct 20 - 25 Nov', NONE],
  [
    'Hotel in Lisbon 20 oct – 25 oct for 2 adults 2 rooms',
    stay('2026-10-20', '2026-10-25', { adults: 2, rooms: 2 }),
    stay('2027-10-20', '2027-10-25', { adults: 2, rooms: 2 }),
  ],
]

export const RELATIVE_DETAIL_LINES: DetailLine[] = [
  // Relative forms resolve forward from the tap day (user decision).
  [
    'Hotel Osaka Sat',
    stay('2026-10-10', '2026-10-11'),
    stay('2027-03-20', '2027-03-21'),
  ],
  [
    'Book hotel Kyoto tomorrow 2 nights',
    stay('2026-10-05', '2026-10-07'),
    stay('2027-03-16', '2027-03-18'),
  ],
  [
    'Hotel Lisbon Thursday for 2 nights',
    stay('2026-10-08', '2026-10-10'),
    stay('2027-03-18', '2027-03-20'),
  ],
  [
    'Hotel Madrid today',
    stay('2026-10-04', '2026-10-05'),
    stay('2027-03-15', '2027-03-16'),
  ],
  [
    'Book hotel Nice tonight for 2',
    stay('2026-10-04', '2026-10-05', { adults: 2 }),
    stay('2027-03-15', '2027-03-16', { adults: 2 }),
  ],
  // Today is a Sunday at the first reference.
  [
    'Hotel Bath Sun–Tue',
    stay('2026-10-04', '2026-10-06'),
    stay('2027-03-21', '2027-03-23'),
  ],
  [
    'Book hotel Glasgow tomorrow to Sunday',
    stay('2026-10-05', '2026-10-11'),
    stay('2027-03-16', '2027-03-21'),
  ],
  [
    'Book hotel Seoul a week from Mon',
    stay('2026-10-05', '2026-10-12'),
    stay('2027-03-15', '2027-03-22'),
  ],
  [
    'Book hotel Osaka Fri for the night',
    stay('2026-10-09', '2026-10-10'),
    stay('2027-03-19', '2027-03-20'),
  ],
  // "next Fri" is this Friday to some, next week's to others.
  ['Book hotel in Rome next Friday', NONE],
  ['Hotel Paris this weekend', NONE],
  ['Hostel Berlin next week', NONE],
  // A name, not a day.
  [
    'Book Sunday Inn Osaka 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  ['Book hotel Oslo 2025-12-10', NONE],
  ['Book hotel Kyoto Oct 28–3', NONE],
  // 3 days: 2 nights or 3?
  ['Book hotel Porto 3 days from 20 Oct', NONE],
  ['Book hotel in Lisbon, 2 ppl', party({ adults: 2 })],
  // Only the first clause's party counts.
  [
    'Book hotel Lisbon 20-25 Oct, then flight to Porto for 3',
    stay('2026-10-20', '2026-10-25'),
    stay('2027-10-20', '2027-10-25'),
  ],
]

// Stage-2 review lines: the Gardener's 72 fresh lines, then Ponytail's
// offset, month-prefix, recent-past, unread-end, cap and clash probes.
export const REVIEW_DETAIL_LINES: DetailLine[] = [
  ['Kyoto ryokan 3n from 12th', NONE],
  ['Osaka 2 nts (Fri+Sat)', NONE],
  [
    'Lisbon Airbnb 5-9 May for 4',
    stay('2027-05-05', '2027-05-09', { adults: 4 }),
  ],
  [
    'Hotel near venue 14-16/11 x2 rooms',
    stay('2026-11-14', '2026-11-16'),
    stay('2027-11-14', '2027-11-16'),
  ],
  ['Book hotel for the wedding 22 Aug', stay('2027-08-22', '2027-08-23')],
  ['Rome hotel w/c 3 June', NONE],
  ['Hotel NYC Thanksgiving week', NONE],
  ['Paris hotel 2 adults + baby', party({ adults: 2 })],
  ['Book hotel 2 nights after the conference', NONE],
  [
    'Hotel 1898 Barcelona 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  ['Hotel Osaka Room 302', NONE],
  [
    'Terminal 2 hotel Heathrow 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct check-in 3pm',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct conf #AB1234',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct booking ref 20261012',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12-15 Oct €150/night',
    stay('2026-10-12', '2026-10-15'),
    stay('2027-10-12', '2027-10-15'),
  ],
  [
    'Hotel Osaka 12 Oct tel 06-1234-5678',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct 10:30 checkout',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  ['Hotel Osaka 12 Oct 2026', stay('2026-10-12', '2026-10-13'), NONE],
  ['Hotel Osaka Fri 9 Oct', stay('2026-10-09', '2026-10-10'), NONE],
  ['Hotel Osaka Fri 12 Oct', NONE],
  ['Hotel Osaka Sat 10 – Mon 12 Oct', stay('2026-10-10', '2026-10-12'), NONE],
  [
    'Hotel Osaka 9th-11th Oct',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  [
    'book hotel osaka 20th-22nd oct',
    stay('2026-10-20', '2026-10-22'),
    stay('2027-10-20', '2027-10-22'),
  ],
  ['Hotel Osaka 9 & 10 Oct', NONE],
  [
    'Hotel Osaka 9 Oct – 2 nights',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  [
    'Hotel Osaka 12 Oct – 3 nights 2 ppl',
    stay('2026-10-12', '2026-10-15', { adults: 2 }),
    stay('2027-10-12', '2027-10-15', { adults: 2 }),
  ],
  [
    'Hotel Osaka arrive 9 Oct depart 11 Oct',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  [
    'Hotel Osaka in 9 Oct out 11 Oct',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  [
    'Hotel Osaka 9 Oct → 11 Oct',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  [
    'Hotel Osaka 9 Oct-11 Oct',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  ['Hotel Osaka Oct 9-11 2026', stay('2026-10-09', '2026-10-11'), NONE],
  ['Hotel Osaka 9 Oct 26', stay('2026-10-09', '2026-10-10'), NONE],
  ['Hotel Osaka 2026/10/09', stay('2026-10-09', '2026-10-10'), NONE],
  ['Hotel Osaka 9 Oct 2026 to 11 Oct', stay('2026-10-09', '2026-10-11'), NONE],
  [
    'Hotel Osaka Fri-Mon',
    stay('2026-10-09', '2026-10-12'),
    stay('2027-03-19', '2027-03-22'),
  ],
  [
    'Hostel Lisbon Sat–Sun',
    stay('2026-10-10', '2026-10-11'),
    stay('2027-03-20', '2027-03-21'),
  ],
  [
    'Hotel Osaka Sat night',
    stay('2026-10-10', '2026-10-11'),
    stay('2027-03-20', '2027-03-21'),
  ],
  [
    'Hotel Osaka Monday night',
    stay('2026-10-05', '2026-10-06'),
    stay('2027-03-15', '2027-03-16'),
  ],
  [
    'Book hotel for Mon night Osaka',
    stay('2026-10-05', '2026-10-06'),
    stay('2027-03-15', '2027-03-16'),
  ],
  [
    'Hotel Osaka tomorrow',
    stay('2026-10-05', '2026-10-06'),
    stay('2027-03-16', '2027-03-17'),
  ],
  ['Hotel Osaka weekend of 9 Oct', NONE],
  [
    'Hotel Osaka 09/10 - 11/10',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  [
    'Hotel Osaka 9-11.10.',
    stay('2026-10-09', '2026-10-11'),
    stay('2027-10-09', '2027-10-11'),
  ],
  [
    'Hotel Lisbon 31 Oct - 2 Nov',
    stay('2026-10-31', '2026-11-02'),
    stay('2027-10-31', '2027-11-02'),
  ],
  [
    'Hotel Osaka 25 Dec - 1 Jan 2 adults 1 child',
    stay('2026-12-25', '2027-01-01', { adults: 2, children: 1 }),
    stay('2027-12-25', '2028-01-01', { adults: 2, children: 1 }),
  ],
  ['Hotel Osaka 29 Feb', NONE, stay('2028-02-29', '2028-03-01')],
  ['Hotel Osaka 31 Nov', NONE],
  [
    'Hotel Osaka 12th of October',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka October 12-15',
    stay('2026-10-12', '2026-10-15'),
    stay('2027-10-12', '2027-10-15'),
  ],
  [
    'Hotel Osaka 12-15 October 2 adults 2 rooms',
    stay('2026-10-12', '2026-10-15', { adults: 2, rooms: 2 }),
    stay('2027-10-12', '2027-10-15', { adults: 2, rooms: 2 }),
  ],
  [
    'Hotel Osaka 12 Oct 2 nights, 2 adults',
    stay('2026-10-12', '2026-10-14', { adults: 2 }),
    stay('2027-10-12', '2027-10-14', { adults: 2 }),
  ],
  [
    'Book hotel Osaka 12-15 Oct, then train to Kyoto 15 Oct',
    stay('2026-10-12', '2026-10-15'),
    stay('2027-10-12', '2027-10-15'),
  ],
  [
    'Hotel Osaka 20 oct 2 nights',
    stay('2026-10-20', '2026-10-22'),
    stay('2027-10-20', '2027-10-22'),
  ],
  [
    'Hotel Osaka 4 Oct',
    stay('2026-10-04', '2026-10-05'),
    stay('2027-10-04', '2027-10-05'),
  ],
  ['Hotel Osaka 3 Oct', NONE, stay('2027-10-03', '2027-10-04')],
  ['Hotel Osaka Christmas Eve', NONE],
  ['Hotel Osaka NYE', NONE],
  [
    'Book hotel next to the station 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel around Shibuya 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct late check-in',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka early check-in 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct around 3pm',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Book hotel Rome for 25 Jan',
    stay('2027-01-25', '2027-01-26'),
    stay('2028-01-25', '2028-01-26'),
  ],
  [
    'Hotel Osaka for 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct 2 adults 2 children 4 and 7',
    stay('2026-10-12', '2026-10-13', { adults: 2, children: 2 }),
    stay('2027-10-12', '2027-10-13', { adults: 2, children: 2 }),
  ],
  [
    'Hotel Osaka 12 Oct 1 adult',
    stay('2026-10-12', '2026-10-13', { adults: 1 }),
    stay('2027-10-12', '2027-10-13', { adults: 1 }),
  ],
  [
    'Hotel Osaka 12 Oct 3 adults 1 room',
    stay('2026-10-12', '2026-10-13', { adults: 3, rooms: 1 }),
    stay('2027-10-12', '2027-10-13', { adults: 3, rooms: 1 }),
  ],
  [
    'Hotel Osaka 12 Oct x2 rooms',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct 2 rooms',
    stay('2026-10-12', '2026-10-13', { rooms: 2 }),
    stay('2027-10-12', '2027-10-13', { rooms: 2 }),
  ],
  [
    'Hotel Osaka 12 Oct 2 kids',
    stay('2026-10-12', '2026-10-13', { children: 2 }),
    stay('2027-10-12', '2027-10-13', { children: 2 }),
  ],
  [
    'Hotel Osaka 12 Oct 4 pax 2 rooms',
    stay('2026-10-12', '2026-10-13', { adults: 4, rooms: 2 }),
    stay('2027-10-12', '2027-10-13', { adults: 4, rooms: 2 }),
  ],
  [
    'Hotel Osaka 12 Oct-14 Oct',
    stay('2026-10-12', '2026-10-14'),
    stay('2027-10-12', '2027-10-14'),
  ],
  [
    'Hotel Osaka 5 Oct-7 Oct',
    stay('2026-10-05', '2026-10-07'),
    stay('2027-10-05', '2027-10-07'),
  ],
  [
    'Hotel Osaka 20 Oct-22',
    stay('2026-10-20', '2026-10-22'),
    stay('2027-10-20', '2027-10-22'),
  ],
  ['Hotel Osaka 20 Oct GMT', NONE],
  ['Hotel Osaka 20 Oct +9', NONE],
  [
    'Book Oct 12-15 Novotel Osaka',
    stay('2026-10-12', '2026-10-15'),
    stay('2027-10-12', '2027-10-15'),
  ],
  [
    'Hotel Osaka Oct 12 - 15 Marriott',
    stay('2026-10-12', '2026-10-15'),
    stay('2027-10-12', '2027-10-15'),
  ],
  [
    'Hotel Osaka 12 Oct - 15 Novotel',
    stay('2026-10-12', '2026-10-15'),
    stay('2027-10-12', '2027-10-15'),
  ],
  [
    'Hotel Oct 20-25 Marina Bay Sands',
    stay('2026-10-20', '2026-10-25'),
    stay('2027-10-20', '2027-10-25'),
  ],
  [
    'Hotel Osaka Oct 5 - 7 Mayfair',
    stay('2026-10-05', '2026-10-07'),
    stay('2027-10-05', '2027-10-07'),
  ],
  ['Hotel Osaka 2 Oct - 6 Oct', NONE, stay('2027-10-02', '2027-10-06')],
  [
    'Hotel Osaka 5 Oct - 7',
    stay('2026-10-05', '2026-10-07'),
    stay('2027-10-05', '2027-10-07'),
  ],
  [
    'Hotel Osaka 31 Oct - 2',
    stay('2026-10-31', '2026-11-02'),
    stay('2027-10-31', '2027-11-02'),
  ],
  [
    'Hotel Osaka 5th Oct - 7th',
    stay('2026-10-05', '2026-10-07'),
    stay('2027-10-05', '2027-10-07'),
  ],
  [
    'Hotel Osaka 31 Dec - 2',
    stay('2026-12-31', '2027-01-02'),
    stay('2027-12-31', '2028-01-02'),
  ],
  ['Hotel Osaka 20 Oct - 15 Oct', NONE],
  ['Hotel Osaka 5 Oct 400 nights', NONE],
  [
    'Hotel Osaka 5 Oct 15 nights',
    stay('2026-10-05', '2026-10-20'),
    stay('2027-10-05', '2027-10-20'),
  ],
  ['Hotel Osaka 5 Oct 0 nights', NONE],
  ['Hotel Osaka Fri 13', NONE],
  ['Hotel Osaka 13 Fri', NONE],
  [
    'Hotel Osaka Oct 20, 2026 - Oct 25, 2026',
    stay('2026-10-20', '2026-10-25'),
    NONE,
  ],
  ['Hotel Osaka 20 Oct 2 nights 25 Oct', NONE],
  [
    'Hotel Osaka for 20 Oct',
    stay('2026-10-20', '2026-10-21'),
    stay('2027-10-20', '2027-10-21'),
  ],
  [
    'Hotel Spanish Steps Rome 12 Oct',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
  [
    'Hotel Osaka 12 Oct late checkout',
    stay('2026-10-12', '2026-10-13'),
    stay('2027-10-12', '2027-10-13'),
  ],
]
