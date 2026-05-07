const REFERENCE_LABEL_PATTERN = /^R[1-9]\d{0,2}$/;

export function normalizeReferenceLabel(value: unknown, fallbackIndex: number) {
  const fallback = `R${fallbackIndex + 1}`;
  if (typeof value !== "string") return fallback;

  const label = value.trim();
  return REFERENCE_LABEL_PATTERN.test(label) ? label : fallback;
}

export function normalizeReferenceLabels(
  rawLabels: unknown[],
  referenceCount: number,
) {
  return Array.from({ length: referenceCount }, (_, index) =>
    normalizeReferenceLabel(rawLabels[index], index),
  );
}
