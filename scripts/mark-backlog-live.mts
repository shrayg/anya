import fs from "node:fs";

const path = "lib/us-records/portal-backlog.ts";
let s = fs.readFileSync(path, "utf8");

const liveNames = [
  "Oklahoma State Courts Network (OSCN)",
  "Hillsborough HOVER Case Search",
  "Delaware CourtConnect",
  "Federal Bureau of Prisons Inmate Locator",
  "Dallas County Wanted and Delinquent Offender Lookup",
];

for (const name of liveNames) {
  const re = new RegExp(
    `("name": "${name.replace(/[()]/g, "\\$&")}"[\\s\\S]*?"liveStatus": ")([^"]+)(")`,
  );
  s = s.replace(re, `$1live$3`);
}

fs.writeFileSync(path, s);
console.log("updated live statuses");
