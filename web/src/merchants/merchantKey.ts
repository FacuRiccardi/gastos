// Key of the merchant -> category dictionary (Firestore collection `merchantCategories`).
// It must stay identical to src/merchant.js (the ingestion service uses that one).
//
// Lower case, without accents, split on anything that is not a letter or a digit. Words that contain
// a digit are dropped, because card statements append codes and numbers that change on every purchase
// ("Spotify P47A11CB7B" -> "spotify"). Returns '' when nothing is left.
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !/\d/.test(word))
    .join('-')
    .slice(0, 100)
}
