// Emoji search: GitHub's shortcodes first (":+1", ":smiley", ":tada"), then words of the Unicode name, then gemoji's
// tags (":happy"). Each emoji keeps its Unicode group and subgroup (plants are Animals & Nature, plant-flower).
import { expect, test } from 'vitest'
import { emoji } from '../src/emoji.ts'
import { searchEmoji } from '../src/behaviours/suggestion.ts'

const chars = async (q: string) => (await searchEmoji(q)).map((e) => e.char)

test('a shortcode finds its emoji first, exactly or by its start', async () => {
  expect((await chars('+1'))[0]).toBe('👍')
  expect((await chars('smiley'))[0]).toBe('😃')
  expect((await chars('tada'))[0]).toBe('🎉')
  expect((await chars('thumbsu'))[0]).toBe('👍')
})

test('then words of the name (underscores for spaces), then tags', async () => {
  expect((await chars('thumbs_up'))[0]).toBe('👍')
  expect(await chars('happy')).toContain('😀') // a tag
  expect((await searchEmoji('smil')).length).toBe(8)
  expect(await chars('zzzzqqq')).toEqual([])
})

test('each emoji has its group and subgroup; the label is its shortcode where it has one', async () => {
  const blossom = emoji.find((e) => e.char === '🌸')!
  expect([blossom.group, blossom.subgroup]).toEqual(['Animals & Nature', 'plant-flower'])
  expect(emoji.find((e) => e.char === '👍')!.label).toBe(':+1:')
  expect(new Set(emoji.map((e) => e.group)).size).toBe(9)
  const newest = emoji.find((e) => !e.aliases.length)!
  expect(newest.label).toBe(newest.name) // gemoji doesn't have it yet: its name
})
