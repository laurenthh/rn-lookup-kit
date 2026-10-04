export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
}

export const FRACTION_CHARS = Object.keys(FRACTIONS).join('')

const IE_PLURALS = new Set(['cookies', 'pies', 'brownies', 'smoothies'])

const IRREGULAR: Record<string, string> = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
}

export const singular = (token: string) => {
  if (token.length < 4 || /\d/.test(token)) return token
  if (IRREGULAR[token]) return IRREGULAR[token]
  if (IE_PLURALS.has(token)) return token.slice(0, -1)
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (/(o|ch|sh|ss|x)es$/.test(token)) return token.slice(0, -2)
  if (/[^su]s$/.test(token)) return token.slice(0, -1)
  return token
}

const NOISE = new RegExp(`[^a-z0-9 %/.${FRACTION_CHARS}]`, 'g')

export const foodTokens = (text: string) =>
  normalize(text)
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\.(?!\d)/g, ' ')
    .replace(NOISE, ' ')
    .split(/\s+/)
    .filter(Boolean)

export const foodKey = (text: string) =>
  foodTokens(text).map(singular).join(' ')
