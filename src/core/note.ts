import type { LookupPatch, NoteLine } from './types'
import { isLookupLink } from './link'

export const lineOwner =
  (owns: NoteLine['owns']) =>
  (line: string): boolean =>
    typeof owns === 'function' ? owns(line) : line.search(owns) !== -1

export const mergeNoteLine = ({
  note,
  line,
}: {
  note: string | null
  line: NoteLine
}) => {
  if (note === null || note.trim() === '') {
    return line.text
  }

  const lines = note.split('\n')
  const index = lines.findIndex(lineOwner(line.owns))

  if (index === -1) {
    return note.endsWith('\n') ? `${note}${line.text}` : `${note}\n${line.text}`
  }

  lines[index] = line.text
  return lines.join('\n')
}

export const applyLookupPatch = ({
  item,
  patch,
}: {
  item: { note: string | null; link: string | null }
  patch: LookupPatch
}) => ({
  note: patch.noteLine
    ? mergeNoteLine({ note: item.note, line: patch.noteLine })
    : item.note,
  link:
    patch.link !== undefined && (item.link === null || isLookupLink(item.link))
      ? patch.link
      : item.link,
})
