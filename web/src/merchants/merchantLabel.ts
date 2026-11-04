// How a merchant is shown in the dictionary. Card statements append codes and amounts to the name
// ("DB.RG 5617 30% ( 36252,42 )"), but the dictionary key already ignores them (see merchantKey), so the
// list shows the name without them ("DB.RG"). Falls back to the name as it came when nothing is left.
export function merchantLabel(name: string): string {
  const words = name.split(/\s+/).filter((word) => /\p{L}/u.test(word) && !/\d/.test(word))
  return words.length > 0 ? words.join(' ') : name.trim()
}
