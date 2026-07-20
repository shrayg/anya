type CatalogGrid = "single" | "double" | "triple" | "quad";

export type CatalogGridSpan = {
  sm?: 1 | 2;
  lg?: 1 | 2 | 3 | 4;
  xl?: 2 | 3 | 4 | 6;
};

function spanForColumns(
  index: number,
  total: number,
  columns: 2 | 3 | 4 | 6,
): 1 | 2 | 3 | 4 | 6 | undefined {
  const remainder = total % columns;

  if (remainder === 0 || index < total - remainder) return undefined;

  const posInLastRow = index - (total - remainder);

  if (remainder === 1) {
    return columns;
  }

  if (remainder === 2) {
    return (columns / 2) as 2 | 3;
  }

  if (remainder === 3 && columns === 4) {
    return posInLastRow === 0 ? 2 : 1;
  }

  if (remainder === 3 && columns === 6) {
    return 2;
  }

  return undefined;
}

export function getCatalogItemSpan(
  index: number,
  total: number,
  grid: CatalogGrid,
): CatalogGridSpan {
  const span: CatalogGridSpan = {};

  if (grid === "quad") {
    const sm = spanForColumns(index, total, 2);
    const lg = spanForColumns(index, total, 4);
    const xl = spanForColumns(index, total, 6);

    if (sm) span.sm = sm as 1 | 2;
    if (lg) span.lg = lg as 1 | 2 | 3 | 4;
    if (xl !== undefined && xl > 1) {
      span.xl = xl as 2 | 3 | 4 | 6;
    }
  } else if (grid === "triple") {
    const sm = spanForColumns(index, total, 2);
    const lg = spanForColumns(index, total, 3);

    if (sm) span.sm = sm as 1 | 2;
    if (lg) span.lg = lg as 1 | 2 | 3;
  } else if (grid === "double") {
    const sm = spanForColumns(index, total, 2);

    if (sm) span.sm = sm as 1 | 2;
  }

  return span;
}

export function getHubSectionSpan(
  index: number,
  total: number,
  sectionTitle: string,
): CatalogGridSpan {
  switch (sectionTitle) {
    case "Financial & Assets":
    case "Platforms":
    case "Dating Apps":
    case "Public Records":
      return getCatalogItemSpan(index, total, "quad");
    case "AI Intelligence":
      return getCatalogItemSpan(index, total, "double");
    default:
      return getCatalogItemSpan(index, total, "triple");
  }
}

export function catalogSpanDataAttributes(
  span: CatalogGridSpan,
): Record<string, string | undefined> {
  return {
    "data-span-sm": span.sm && span.sm > 1 ? String(span.sm) : undefined,
    "data-span-lg": span.lg && span.lg > 1 ? String(span.lg) : undefined,
    "data-span-xl": span.xl && span.xl > 1 ? String(span.xl) : undefined,
  };
}

export function hubSectionLayoutClass(title: string): string {
  switch (title) {
    case "AI Intelligence":
    case "Financial & Assets":
    case "Crypto Intel":
    case "Stealer Intel":
    case "Breach & Leaks":
    case "Identity":
    case "Public Records":
    case "Network":
      return "module-hub-section--full";
    default:
      return "module-hub-section--half";
  }
}
