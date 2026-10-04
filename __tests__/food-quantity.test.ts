import { describe, expect, it } from 'vitest'
import { foodKey, singular } from '../src/core/normalize'
import type { QuantitySplit } from '../src/food/quantity'
import { leadQuantity, quantitySplits } from '../src/food/quantity'

const split = (
  amount: number | null,
  unit: QuantitySplit['unit'],
  name: string,
): QuantitySplit => ({ amount, unit, name })

const parsed = quantitySplits

describe('singular', () => {
  it.each([
    ['tomatoes', 'tomato'],
    ['potatoes', 'potato'],
    ['berries', 'berry'],
    ['cherries', 'cherry'],
    ['cookies', 'cookie'],
    ['pies', 'pie'],
    ['leaves', 'leaf'],
    ['loaves', 'loaf'],
    ['knives', 'knife'],
    ['olives', 'olive'],
    ['peaches', 'peach'],
    ['radishes', 'radish'],
    ['eggs', 'egg'],
    ['peas', 'pea'],
    ['hummus', 'hummus'],
    ['couscous', 'couscous'],
    ['asparagus', 'asparagus'],
    ['bass', 'bass'],
    ['oz', 'oz'],
    ['80/20', '80/20'],
  ])('%s → %s', (plural, expected) => {
    expect(singular(plural)).toBe(expected)
  })
})

describe('foodKey', () => {
  it('lowercases, strips diacritics and punctuation, and singularises', () => {
    expect(foodKey('  Jalapeños, sliced ')).toBe('jalapeno sliced')
    expect(foodKey("Confectioners' Sugar")).toBe('confectioner sugar')
    expect(foodKey('sweet & sour sauce')).toBe('sweet and sour sauce')
    expect(foodKey('low-fat milk')).toBe('low fat milk')
    expect(foodKey('Bananas 🍌')).toBe('banana')
  })

  it('keeps digits, percent and ratio aliases intact', () => {
    expect(foodKey('2% milk')).toBe('2% milk')
    expect(foodKey('ground beef 80/20')).toBe('ground beef 80/20')
    expect(foodKey('7up')).toBe('7up')
  })
})

describe('quantitySplits', () => {
  it('yields nothing for text without a quantity', () => {
    expect(parsed('2% milk')).toEqual([])
    expect(parsed('ground beef 80/20')).toEqual([])
    expect(parsed('milk')).toEqual([])
  })

  it.each([
    ['6 eggs', split(6, null, 'eggs')],
    ['2.5 apples', split(2.5, null, 'apples')],
    ['1/2 onion', split(0.5, null, 'onion')],
    ['1 1/2 cups flour', split(1.5, 'cup', 'flour')],
    ['½ cup sugar', split(0.5, 'cup', 'sugar')],
    ['1½ cups rice', split(1.5, 'cup', 'rice')],
    ['⅓ cup oil', split(1 / 3, 'cup', 'oil')],
    ['a banana', split(1, null, 'banana')],
    ['an apple', split(1, null, 'apple')],
    ['half an onion', split(0.5, null, 'onion')],
    ['a dozen eggs', split(12, null, 'eggs')],
    ['half a dozen eggs', split(6, null, 'eggs')],
    ['dozen eggs', split(12, null, 'eggs')],
    ['2x bagels', split(2, null, 'bagels')],
    ['x2 bagels', split(2, null, 'bagels')],
    ['2 x bagels', split(2, null, 'bagels')],
    ['2 cups of rice', split(2, 'cup', 'rice')],
    ['1 large onion', split(1, 'large', 'onion')],
    ['large eggs', split(null, 'large', 'eggs')],
  ])('leading: %s', (text, expected) => {
    expect(parsed(text)).toEqual([expected])
  })

  it.each([
    ['500g minced beef', split(500, 'g', 'minced beef')],
    ['500 grams minced beef', split(500, 'g', 'minced beef')],
    ['1.5kg potatoes', split(1.5, 'kg', 'potatoes')],
    ['1,5 kg potatoes', split(1.5, 'kg', 'potatoes')],
    ['1 kilo potatoes', split(1, 'kg', 'potatoes')],
    ['2 lbs. apples', split(2, 'lb', 'apples')],
    ['8 oz cheddar', split(8, 'oz', 'cheddar')],
    ['1l milk', split(1, 'l', 'milk')],
    ['1 litre milk', split(1, 'l', 'milk')],
    ['500ml milk', split(500, 'ml', 'milk')],
    ['2 tablespoons honey', split(2, 'tbsp', 'honey')],
    ['1 teaspoon salt', split(1, 'tsp', 'salt')],
    ['2 slices bread', split(2, 'slice', 'bread')],
    ['3 cloves garlic', split(3, 'clove', 'garlic')],
    ['4 pcs chicken', split(4, 'piece', 'chicken')],
    ['a handful of nuts', split(1, 'handful', 'nuts')],
    ['2 handfuls almonds', split(2, 'handful', 'almonds')],
    ['2 scoops protein', split(2, 'scoop', 'protein')],
    ['a bowl of cereal', split(1, 'bowl', 'cereal')],
    ['a glass of juice', split(1, 'glass', 'juice')],
    ['2 glasses of wine', split(2, 'glass', 'wine')],
    ['bowl of cereal', split(null, 'bowl', 'cereal')],
    ['handful of nuts', split(null, 'handful', 'nuts')],
  ])('units: %s', (text, expected) => {
    expect(parsed(text)).toEqual([expected])
  })

  it.each([
    ['chicken breast 200g', split(200, 'g', 'chicken breast')],
    ['milk 1l', split(1, 'l', 'milk')],
    ['eggs x2', split(2, null, 'eggs')],
    ['Eggs (12)', split(12, null, 'eggs')],
    ['tomatoes, 6', split(6, null, 'tomatoes')],
    ['milk 1 1/2 l', split(1.5, 'l', 'milk')],
  ])('trailing: %s', (text, expected) => {
    expect(parsed(text)).toEqual([expected])
  })

  it('drops the amount for container words', () => {
    expect(parsed('1 bag spinach')).toEqual([split(null, null, 'spinach')])
    expect(parsed('2 cans of chickpeas')).toEqual([
      split(null, null, 'chickpeas'),
    ])
    expect(parsed('milk 2 cartons')).toEqual([split(null, null, 'milk')])
  })

  it('leaves ratio and percent tokens alone', () => {
    expect(parsed('500g ground beef 80/20')).toEqual([
      split(500, 'g', 'ground beef 80/20'),
    ])
    expect(parsed('1l 2% milk')).toEqual([split(1, 'l', '2% milk')])
    expect(parsed('95/5 ground beef')).toEqual([])
    expect(parsed('7up')).toEqual([])
  })

  it('needs an amount for every unit but a size', () => {
    expect(parsed('cup sugar')).toEqual([])
    expect(parsed('sugar cup')).toEqual([])
    expect(parsed('salad bowl')).toEqual([])
    expect(parsed('wine glass')).toEqual([])
    expect(parsed('glass milk')).toEqual([])
  })

  it('reads the leading quantity alone', () => {
    expect(leadQuantity('a handful of fruit')).toEqual(
      split(1, 'handful', 'fruit'),
    )
    expect(leadQuantity('eggs x2')).toBeNull()
    expect(leadQuantity('2')).toEqual(split(2, null, ''))
  })

  it('never yields an empty name', () => {
    expect(parsed('200g')).toEqual([])
    expect(parsed('')).toEqual([])
  })
})
