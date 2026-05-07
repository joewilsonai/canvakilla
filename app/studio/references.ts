import type { ReferenceItem } from "./types";

const REFERENCE_INSTRUCTION_LINE =
  /^\s*Use Reference R\d{1,3} \([^\n]+\) as a visual reference\.\s*$/gim;

export function getNextReferenceNumber(references: ReferenceItem[]) {
  return references.reduce((max, reference) => {
    const number = Number(reference.label.replace(/^R/, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
}

export function normalizeReferenceItems(references: ReferenceItem[]) {
  return references.map((reference) => ({
    id: reference.id,
    image: reference.image,
    name: reference.name,
    label: reference.label,
    createdAt: reference.createdAt,
  }));
}

export function getReferenceInstruction(reference: ReferenceItem) {
  return `Use Reference ${reference.label} (${reference.name}) as a visual reference.`;
}

export function removeAllReferenceInstructions(prompt: string) {
  return prompt
    .replace(REFERENCE_INSTRUCTION_LINE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function syncReferenceInstructions(
  prompt: string,
  selectedReferences: ReferenceItem[],
) {
  const basePrompt = removeAllReferenceInstructions(prompt);
  const instructions = selectedReferences.map(getReferenceInstruction);

  return [basePrompt, ...instructions].filter(Boolean).join("\n\n").trim();
}
