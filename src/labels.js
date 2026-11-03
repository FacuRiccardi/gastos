// Returns the internal Gmail id (like Label_123) of the label with the given name.
export function findLabelId(labels, name) {
  const label = labels.find((l) => l.name === name);
  if (!label) {
    const available = labels.map((l) => l.name).join(', ');
    throw new Error(`Label "${name}" not found. Available labels: ${available}`);
  }
  return label.id;
}
