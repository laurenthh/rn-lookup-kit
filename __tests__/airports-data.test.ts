import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { airportFor } from '../src/places/airports'

describe('airports dataset', () => {
  it('stays within the 150 KB budget', () => {
    const file = join(__dirname, '..', 'src', 'places', 'airports.json')
    const bytes = Buffer.byteLength(readFileSync(file, 'utf8'), 'utf8')
    expect(bytes).toBeLessThanOrEqual(150 * 1024)
  })

  it('has every key as 3 uppercase letters, with no duplicates', () => {
    const file = join(__dirname, '..', 'src', 'places', 'airports.json')
    const raw = readFileSync(file, 'utf8')
    const data = JSON.parse(raw) as Record<string, string>
    const keys = Object.keys(data)
    expect(keys.length).toBeGreaterThan(1000)
    for (const key of keys) expect(key).toMatch(/^[A-Z]{3}$/)
    // JSON.parse already collapses duplicate keys; check the source text
    // too so a build regression that writes "MAN" twice is caught.
    const quoted = raw.match(/"[A-Z]{3}":/g) ?? []
    expect(quoted.length).toBe(keys.length)
    expect(new Set(quoted).size).toBe(quoted.length)
  })

  it('resolves well-known codes to the city a traveller expects', () => {
    expect(airportFor('MAN')).toBe('Manchester')
    expect(airportFor('AGP')).toBe('Málaga')
    expect(airportFor('SYD')).toBe('Sydney')
    // Osaka's two airports: KIX's own municipality is already "Osaka".
    expect(airportFor('KIX')).toBe('Osaka')
    // Narita and Haneda both serve Tokyo; NRT is curated (see
    // CITY_OVERRIDE in build-airports.ts) since its own municipality is
    // "Narita".
    expect(airportFor('NRT')).toBe('Tokyo')
    expect(airportFor('HND')).toBe('Tokyo')
    expect(airportFor('LHR')).toBe('London')
    expect(airportFor('LGW')).toBe('London')
    expect(airportFor('JFK')).toBe('New York')
    expect(airportFor('CDG')).toBe('Paris')
    // Zurich is curated too: OurAirports strips the umlaut from its own
    // municipality field but keeps it in the airport name.
    expect(airportFor('ZRH')).toBe('Zürich')
  })

  it('returns null for an unknown code', () => {
    expect(airportFor('XXX')).toBeNull()
    expect(airportFor('')).toBeNull()
  })

  it('is case-insensitive and trims input', () => {
    expect(airportFor('man')).toBe('Manchester')
    expect(airportFor('Agp')).toBe('Málaga')
    expect(airportFor(' man ')).toBe('Manchester')
  })

  // The world's busiest airports (our own ~65-hub list, plus the
  // independent 115-hub research list scored by
  // scratchpad/lib-research/score-ours.ts — 115/115 as of 2026-10-03),
  // the city a traveller would say. Many of these only resolve correctly
  // because of the name-prefix/reversed-comma rules or the EXONYM map in
  // build-airports.ts (BRU, EDI, LYS, ATH, MXP, LIN, KUL, SAW, CGN, VCE,
  // GOT, HAJ, TRN); the rest were already right from `municipality`
  // alone and are here as a regression net. Deliberate shortenings/
  // decisions (all CITY_OVERRIDE, 2026-10-03): FRA "Frankfurt" over its
  // own longer-but-correct "Frankfurt am Main"; DPS "Bali" over the
  // served city "Denpasar" (what a traveller actually says for
  // Indonesia's tourist gateway); NGO "Nagoya" and TPE "Taipei" since
  // neither airport's own name mentions the city it serves at all. EWR
  // says "Newark", not "New York" — a distinct city, and what EWR's own
  // municipality already says. DEL says "New Delhi", matching its own
  // municipality, over plain "Delhi". Diacritics are kept throughout
  // (Málaga, Zürich, Reykjavík, Montréal, Düsseldorf, Cancún, São Paulo).
  it('resolves the busiest airports worldwide', () => {
    const hubs: Record<string, string> = {
      BRU: 'Brussels',
      EDI: 'Edinburgh',
      LYS: 'Lyon',
      ATH: 'Athens',
      MXP: 'Milan',
      LIN: 'Milan',
      TRN: 'Turin',
      VRN: 'Verona',
      FCO: 'Rome',
      CIA: 'Rome',
      VCE: 'Venice',
      NAP: 'Naples',
      FLR: 'Florence',
      KUL: 'Kuala Lumpur',
      BKK: 'Bangkok',
      DMK: 'Bangkok',
      ICN: 'Seoul',
      GMP: 'Seoul',
      NRT: 'Tokyo',
      HND: 'Tokyo',
      KIX: 'Osaka',
      ITM: 'Osaka',
      CTS: 'Sapporo',
      FUK: 'Fukuoka',
      NGO: 'Nagoya',
      OKA: 'Naha',
      PEK: 'Beijing',
      PKX: 'Beijing',
      PVG: 'Shanghai',
      SHA: 'Shanghai',
      HKG: 'Hong Kong',
      TPE: 'Taipei',
      SIN: 'Singapore',
      DXB: 'Dubai',
      DOH: 'Doha',
      IST: 'Istanbul',
      SAW: 'Istanbul',
      CDG: 'Paris',
      ORY: 'Paris',
      LHR: 'London',
      LGW: 'London',
      STN: 'London',
      LTN: 'London',
      AMS: 'Amsterdam',
      FRA: 'Frankfurt',
      MUC: 'Munich',
      BER: 'Berlin',
      HAM: 'Hamburg',
      DUS: 'Düsseldorf',
      STR: 'Stuttgart',
      CGN: 'Cologne',
      HAJ: 'Hanover',
      GOT: 'Gothenburg',
      ZRH: 'Zürich',
      GVA: 'Geneva',
      VIE: 'Vienna',
      CPH: 'Copenhagen',
      ARN: 'Stockholm',
      OSL: 'Oslo',
      HEL: 'Helsinki',
      DUB: 'Dublin',
      MAD: 'Madrid',
      BCN: 'Barcelona',
      ALC: 'Alicante',
      PMI: 'Palma de Mallorca',
      TFS: 'Tenerife',
      LIS: 'Lisbon',
      OPO: 'Porto',
      FAO: 'Faro',
      PRG: 'Prague',
      BUD: 'Budapest',
      WAW: 'Warsaw',
      NCE: 'Nice',
      BHX: 'Birmingham',
      GLA: 'Glasgow',
      BRS: 'Bristol',
      KEF: 'Reykjavík',
      JFK: 'New York',
      EWR: 'Newark',
      LGA: 'New York',
      SFO: 'San Francisco',
      LAX: 'Los Angeles',
      ORD: 'Chicago',
      ATL: 'Atlanta',
      DFW: 'Dallas',
      LAS: 'Las Vegas',
      MIA: 'Miami',
      MCO: 'Orlando',
      BOS: 'Boston',
      SEA: 'Seattle',
      IAD: 'Washington',
      DCA: 'Washington',
      HNL: 'Honolulu',
      YYZ: 'Toronto',
      YVR: 'Vancouver',
      YUL: 'Montréal',
      MEX: 'Mexico City',
      CUN: 'Cancún',
      GRU: 'São Paulo',
      EZE: 'Buenos Aires',
      BOG: 'Bogota',
      LIM: 'Lima',
      JNB: 'Johannesburg',
      CPT: 'Cape Town',
      CAI: 'Cairo',
      CMN: 'Casablanca',
      NBO: 'Nairobi',
      ADD: 'Addis Ababa',
      DEL: 'New Delhi',
      BOM: 'Mumbai',
      BLR: 'Bengaluru',
      CGK: 'Jakarta',
      MNL: 'Manila',
      DPS: 'Bali',
      HAN: 'Hanoi',
      SGN: 'Ho Chi Minh City',
      CNX: 'Chiang Mai',
      HKT: 'Phuket',
      SYD: 'Sydney',
      MEL: 'Melbourne',
      BNE: 'Brisbane',
      AKL: 'Auckland',
    }
    for (const [code, city] of Object.entries(hubs)) {
      expect(airportFor(code)).toBe(city)
    }
  })

  // Pure city/metro codes (no physical airport) resolve exactly like a
  // real airport code (METRO_CITIES in build-airports.ts). A handful of
  // codes some travel sites also treat as "the city" (BER, BKK, HOU,
  // LAX, OSL, SHA) are deliberately absent here — they're already a
  // real airport above.
  it('resolves metro/city codes the same way as airport codes', () => {
    const metros: Record<string, string> = {
      LON: 'London',
      NYC: 'New York',
      PAR: 'Paris',
      TYO: 'Tokyo',
      OSA: 'Osaka',
      MIL: 'Milan',
      ROM: 'Rome',
      WAS: 'Washington',
      CHI: 'Chicago',
      SEL: 'Seoul',
      STO: 'Stockholm',
      BJS: 'Beijing',
      MOW: 'Moscow',
      BUE: 'Buenos Aires',
      SAO: 'São Paulo',
      RIO: 'Rio de Janeiro',
      YTO: 'Toronto',
      YMQ: 'Montréal',
      REK: 'Reykjavík',
      JKT: 'Jakarta',
      DTT: 'Detroit',
    }
    for (const [code, city] of Object.entries(metros)) {
      expect(airportFor(code)).toBe(city)
    }
  })
})
