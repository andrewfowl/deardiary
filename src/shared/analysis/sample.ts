/** Pick up to `max` items spread evenly across the list (always keeps first and last). */
export function sampleEvenly<T>(items: T[], max: number): T[] {
  if (max <= 0) return []
  if (items.length <= max) return [...items]
  if (max === 1) return [items[0]]
  const result: T[] = []
  const step = (items.length - 1) / (max - 1)
  let lastIndex = -1
  for (let i = 0; i < max; i++) {
    const index = Math.round(i * step)
    if (index !== lastIndex) {
      result.push(items[index])
      lastIndex = index
    }
  }
  return result
}
