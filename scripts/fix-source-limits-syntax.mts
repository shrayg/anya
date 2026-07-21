import fs from "node:fs";

function fixFl() {
  let s = fs.readFileSync("lib/us-records/fl-sunbiz.ts", "utf8");
  s = s.replaceAll("SOURCE_LIMITS[].timeoutMs", 'SOURCE_LIMITS["fl-sunbiz"].timeoutMs');
  s = s.replaceAll("SOURCE_LIMITS[].ttlMs", 'SOURCE_LIMITS["fl-sunbiz"].ttlMs');
  fs.writeFileSync("lib/us-records/fl-sunbiz.ts", s);
}

function fixProp() {
  let s = fs.readFileSync("lib/us-records/us-property-open.ts", "utf8");
  // Three setCached lines got corrupted to SOURCE_LIMITS[].ttlMs;
  const ids = ["nyc-pluto", "nyc-acris", "philly-opa"];
  let i = 0;
  s = s.replace(/SOURCE_LIMITS\[\]\.ttlMs;/g, () => {
    const id = ids[i++] || "nyc-pluto";
    return `SOURCE_LIMITS["${id}"].ttlMs);`;
  });
  fs.writeFileSync("lib/us-records/us-property-open.ts", s);
}

fixFl();
fixProp();
console.log("ok");
