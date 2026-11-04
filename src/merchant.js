// Key of the merchant -> category dictionary (Firestore collection `merchantCategories`).
// It must stay identical to web/src/merchants/merchantKey.ts.
//
// Lower case, without accents, split on anything that is not a letter or a digit. Words that contain
// a digit are dropped, because card statements append codes and numbers that change on every purchase
// ("Spotify P47A11CB7B" -> "spotify"). Returns '' when nothing is left.
export function merchantKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !/\d/.test(word))
    .join('-')
    .slice(0, 100);
}
