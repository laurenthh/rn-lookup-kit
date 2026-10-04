// Vocabulary for dining lines, normalised (lowercase, no accents).

const words = (list: string) => new Set(list.split(/\s+/).filter(Boolean))

export const MEALS = words(`
  breakfast brekkie brunch lunch dinner supper tea afternoon drinks drink
  cocktails cocktail coffee coffees aperitivo aperitif apero dessert desserts
  snack snacks roast pint pints nightcap meal takeaway takeout
`)

const DISHES = words(`
  pizza pasta ramen udon soba sushi sashimi tempura yakitori takoyaki
  okonomiyaki gyoza dumplings dim sum noodles pho banh mi curry tacos taco
  burrito burritos tamales churros elote corn mole conchas tortas chilaquiles
  ceviche tapas paella pintxos croissant croissants pastry pastries bun buns
  bread cake cakes cheesecake donuts doughnuts bagel bagels burger burgers steak
  bbq barbecue oysters seafood fish chips salad sandwich sandwiches poke bowl
  gelato ice cream crepes waffles pancakes chocolate hot matcha flat white
  espresso latte wine beer beers mezcal prosecco champagne sake whisky pain
  macarons fries falafel kebab birria shrimp margs margaritas cardamom guava
  roll rolls pastel pasteis schnitzel pretzel bratwurst pastrami slice
`)

// Words a venue's own name may carry ("Brasserie Zédel", "Sushi Saito").
export const VENUE_TYPES = words(`
  restaurant restaurants resturant ristorante trattoria osteria enoteca
  pizzeria taqueria pulqueria cantina panaderia boulangerie patisserie bakery
  bakehouse cafe cafes coffeehouse tearoom bar bars pub pubs tavern taverna
  bistro brasserie izakaya diner deli kitchen grill steakhouse market mercado
  hawker stall stalls konbini gelateria creperie canteen place spot joint
  roastery speakeasy rooftop truck hall food
`)

const CUISINES = words(`
  italian thai vietnamese mexican japanese korean chinese cantonese sichuan
  indian french greek spanish turkish lebanese ethiopian vegan vegetarian
  veggie peruvian kaiseki omakase natural street
`)

// Booking words: never part of a name.
const BOOKING = words(`
  table tables seats seat private room reservation reservations booking reso
  rsv
`)

export const isDiningWord = (word: string) =>
  MEALS.has(word) ||
  DISHES.has(word) ||
  VENUE_TYPES.has(word) ||
  CUISINES.has(word)

export const isFoodWord = (word: string) =>
  DISHES.has(word) || CUISINES.has(word)

export const isBookingWord = (word: string) => BOOKING.has(word)

// Dropped from every line: a day or month is never part of the venue.
export const WHEN = words(`
  mon tue tues wed thu thur thurs fri sat sun monday tuesday wednesday
  thursday friday saturday sunday jan feb mar apr jun jul aug sep sept oct
  nov dec january february march april june july august september october
  november december today tonight tomorrow
`)

// Capitalised but never a venue: words people start a line with ("Team
// lunch", "Backup: Rubirosa").
export const NOT_NAME = words(`
  i rm backup something maybe late team client work office that this birthday
  farewell date next karaoke note anniversary
`)

// Before a name, nothing a Maps search needs: "Brunch next day Russ & …".
export const PREAMBLE = words(`
  next day night after catch up catch-up quick a the late early
`)

// After a capitalised meal word, the rest of a name: "Breakfast Club".
export const MEAL_NAME_TAILS = words(`
  club co room house society lab social kitchen bar
`)

// Joins the words of one name: "Du Pain et des Idées", "Russ & Daughters".
export const CONNECTORS = words(`
  de del della delle di da dal du des et la le les el los las y e & + and of
  the al n
`)

// What a name is introduced by: "Dinner at Kikunoi", "Cake from Lady M".
export const BEFORE_NAME = words(`at @ from`)

// What an area is introduced by: "Izakaya night in Shinjuku".
export const BEFORE_AREA = words(`in on near off by around outside`)

// Line-leading verbs that don't name the venue: "Try Padella", "Book Zuma".
export const LEAD_VERBS = words(`
  book rebook reserve rsv rsvn reservation reservations resevation reso try
  visit grab hit
`)

// First words of a chore: a link can't help ("Call Carbone", "Order …").
export const CHORES = words(`
  order check expense buy collect return leave write review tip split bring
  cook make prep invite remind ring pick
`)
