export type MindMapNodeData = {
  label: string;
  sublabel?: string;
  kind: "center" | "search" | "field" | "value";
  accent?: string;
};

export type SearchHistoryItem = {
  id: number;
  query: string;
  searchType: string;
  resultData: string;
  createdAt: string;
};

export type CaseWithSearches = {
  id: number;
  title: string;
  subjectName: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  location: string | null;
  notes: string;
  intelData: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  searches: Array<{
    id: number;
    searchHistory: SearchHistoryItem;
  }>;
};

function flattenResults(
  data: unknown,
  prefix = "",
  rows: Array<{ label: string; value: string }> = [],
  depth = 0,
): Array<{ label: string; value: string }> {
  if (depth > 3 || rows.length > 24) return rows;
  if (data === null || data === undefined) return rows;

  if (Array.isArray(data)) {
    if (data.length > 0) {
      rows.push({
        label: prefix || "results",
        value: data.slice(0, 3).map((item) => JSON.stringify(item)).join(" · "),
      });
    }
    return rows;
  }

  if (typeof data !== "object") {
    rows.push({ label: prefix || "value", value: String(data) });
    return rows;
  }

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      flattenResults(value, label, rows, depth + 1);
    } else if (value !== null && value !== undefined && String(value).trim()) {
      rows.push({ label, value: String(value) });
    }
  }

  return rows;
}

function parseSearchQuery(raw: string) {
  const match = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return { type: "search", query: raw };
  }
  return { type: match[1], query: match[2] || raw };
}

export function buildCaseMindMap(caseRecord: CaseWithSearches) {
  const nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: MindMapNodeData;
  }> = [];
  const edges: Array<{ id: string; source: string; target: string; animated?: boolean }> =
    [];

  const centerId = "center";
  nodes.push({
    id: centerId,
    type: "intelNode",
    position: { x: 0, y: 0 },
    data: {
      kind: "center",
      label: caseRecord.title,
      sublabel: caseRecord.subjectName,
      accent: "#a78bfa",
    },
  });

  const profileFields = [
    { key: "email", label: "Email", value: caseRecord.email },
    { key: "phone", label: "Phone", value: caseRecord.phone },
    { key: "username", label: "Username", value: caseRecord.username },
    { key: "location", label: "Location", value: caseRecord.location },
  ].filter((field) => field.value);

  profileFields.forEach((field, index) => {
    const fieldId = `profile-${field.key}`;
    const angle = (index / Math.max(profileFields.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = 220;
    nodes.push({
      id: fieldId,
      type: "intelNode",
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius - 40,
      },
      data: {
        kind: "field",
        label: field.label,
        sublabel: field.value || "",
        accent: "#2dd4bf",
      },
    });
    edges.push({ id: `e-${centerId}-${fieldId}`, source: centerId, target: fieldId });
  });

  const searches = caseRecord.searches.map((link) => link.searchHistory);
  const searchCount = searches.length;
  const searchRadius = 380;

  searches.forEach((search, searchIndex) => {
    const parsed = parseSearchQuery(search.query);
    const type = search.searchType || parsed.type;
    const searchId = `search-${search.id}`;
    const angle =
      (searchIndex / Math.max(searchCount, 1)) * Math.PI * 2 - Math.PI / 2;
    const sx = Math.cos(angle) * searchRadius;
    const sy = Math.sin(angle) * searchRadius + 80;

    nodes.push({
      id: searchId,
      type: "intelNode",
      position: { x: sx, y: sy },
      data: {
        kind: "search",
        label: type.toUpperCase(),
        sublabel: parsed.query,
        accent: "#818cf8",
      },
    });
    edges.push({
      id: `e-${centerId}-${searchId}`,
      source: centerId,
      target: searchId,
      animated: true,
    });

    let resultRows: Array<{ label: string; value: string }> = [];
    if (search.resultData) {
      try {
        resultRows = flattenResults(JSON.parse(search.resultData));
      } catch {
        resultRows = [{ label: "raw", value: search.resultData.slice(0, 120) }];
      }
    }

    const childRadius = 150;
    const visibleRows = resultRows.slice(0, 6);
    visibleRows.forEach((row, rowIndex) => {
      const childId = `${searchId}-field-${rowIndex}`;
      const childAngle =
        angle + ((rowIndex - (visibleRows.length - 1) / 2) * Math.PI) / 8;
      nodes.push({
        id: childId,
        type: "intelNode",
        position: {
          x: sx + Math.cos(childAngle) * childRadius,
          y: sy + Math.sin(childAngle) * childRadius,
        },
        data: {
          kind: "value",
          label: row.label,
          sublabel: row.value.slice(0, 80),
          accent: "#34d399",
        },
      });
      edges.push({
        id: `e-${searchId}-${childId}`,
        source: searchId,
        target: childId,
      });
    });
  });

  return { nodes, edges };
}
