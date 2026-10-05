// Stay arithmetic shared by the booking-line parser (`travel/details`) and
// the link builders (`core/build`): Booking.com's limits and YYYY-MM-DD days.

export const MAX_PEOPLE = 30
export const MAX_CHILDREN = 10
// Booking.com caps a stay at 30 nights.
export const MAX_NIGHTS = 30

const DAY = /^\d{4}-\d{2}-\d{2}$/

// A whole number in [min, max], else null.
export const within = (
  value: number | null | undefined,
  max: number,
  min = 1,
) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max
    ? value
    : null

// [year, month index, day] of a YYYY-MM-DD day.
export const ymd = (day: string): [number, number, number] => {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return [year, month - 1, date]
}

// A real calendar day written YYYY-MM-DD.
export const isDay = (day: string) => {
  if (!DAY.test(day)) {
    return false
  }
  const [year, month, date] = ymd(day)
  const at = new Date(Date.UTC(year, month, date))
  return (
    at.getUTCFullYear() === year &&
    at.getUTCMonth() === month &&
    at.getUTCDate() === date
  )
}

export const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.round(
    (Date.UTC(...ymd(checkOut)) - Date.UTC(...ymd(checkIn))) / 86_400_000,
  )
