export const borrowerTypes = ["老師", "在校生家長", "畢業生家長", "華德福社群"] as const;

export type BorrowerType = (typeof borrowerTypes)[number];

const separator = "｜";

export function isBorrowerType(value: unknown): value is BorrowerType {
  return borrowerTypes.includes(value as BorrowerType);
}

export function encodeBorrowerGroup(type: BorrowerType, childClass: string) {
  return type === "在校生家長" ? `${type}${separator}${childClass.trim()}` : type;
}

export function parseBorrowerGroup(value?: string | null): {
  type: BorrowerType;
  childClass: string;
} {
  const stored = value?.trim() ?? "";
  const matchedType = borrowerTypes.find((type) => stored === type || stored.startsWith(`${type}${separator}`));

  if (!matchedType) {
    return { type: "在校生家長", childClass: stored };
  }

  return {
    type: matchedType,
    childClass: matchedType === "在校生家長" ? stored.slice(`${matchedType}${separator}`.length) : ""
  };
}
