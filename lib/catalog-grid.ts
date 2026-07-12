type CatalogGrid = "single" | "double" | "triple" | "quad";

function spanForColumns(
  index: number,
  total: number,
  columns: 2 | 3 | 4,
  breakpoint: "sm" | "lg",
): string | undefined {
  const remainder = total % columns;
  if (remainder === 0 || index < total - remainder) return undefined;

  const posInLastRow = index - (total - remainder);

  if (remainder === 1) {
    if (breakpoint === "sm" && columns === 2) return "sm:col-span-2";
    if (breakpoint === "lg" && columns === 4) return "lg:col-span-4";
    if (breakpoint === "lg" && columns === 3) return "lg:col-span-3";
    return undefined;
  }

  if (remainder === 2) {
    if (breakpoint === "lg" && columns === 4) return "lg:col-span-2";
    return undefined;
  }

  if (remainder === 3 && columns === 4 && breakpoint === "lg") {
    return posInLastRow === 0 ? "lg:col-span-2" : undefined;
  }

  return undefined;
}

export function getCatalogItemSpanClasses(
  index: number,
  total: number,
  grid: CatalogGrid,
): string | undefined {
  const classes: string[] = [];

  if (grid === "quad") {
    const sm = spanForColumns(index, total, 2, "sm");
    const lg = spanForColumns(index, total, 4, "lg");
    if (sm) classes.push(sm);
    if (lg) classes.push(lg);
  } else if (grid === "triple") {
    const sm = spanForColumns(index, total, 2, "sm");
    const lg = spanForColumns(index, total, 3, "lg");
    if (sm) classes.push(sm);
    if (lg) classes.push(lg);
  } else if (grid === "double") {
    const sm = spanForColumns(index, total, 2, "sm");
    if (sm) classes.push(sm);
  }

  return classes.length > 0 ? classes.join(" ") : undefined;
}

export function getHubSectionSpanClasses(
  index: number,
  total: number,
  sectionTitle: string,
): string | undefined {
  switch (sectionTitle) {
    case "Financial & Assets":
    case "Platforms":
    case "Dating Apps":
      return getCatalogItemSpanClasses(index, total, "quad");
    case "AI Intelligence":
      return getCatalogItemSpanClasses(index, total, "double");
    default:
      return getCatalogItemSpanClasses(index, total, "triple");
  }
}
