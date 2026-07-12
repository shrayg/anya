import fs from "fs";
import path from "path";

const root = "app/api/osint";
const segmentByFile = {
  "ai/route.ts": "ai",
  "bank/route.ts": "bank",
  "bin/route.ts": "bin",
  "breach/route.ts": "breach",
  "breaches/route.ts": "breaches",
  "car-insurance/route.ts": "car-insurance",
  "crypto-wallet/route.ts": "crypto-wallet",
  "discord/route.ts": "discord",
  "discord/profile/route.ts": "discord/profile",
  "dns/route.ts": "dns",
  "domains/route.ts": "domains",
  "fivem/route.ts": "fivem",
  "geolocate/route.ts": "geolocate",
  "healthcare/route.ts": "healthcare",
  "iban/route.ts": "iban",
  "intelx/route.ts": "intelx",
  "ip/route.ts": "ip",
  "minecraft/route.ts": "minecraft",
  "reddit/route.ts": "reddit",
  "roblox/route.ts": "roblox",
  "vin/route.ts": "vin",
};

const guardImport = 'import { requireOsintAccess } from "@/lib/osint-api-auth";\n';

function injectGuard(content, segment) {
  if (content.includes("requireOsintAccess")) return content;

  let next = content.replace(
    /(import \{[^}]*\} from "next\/server";\r?\n)/,
    `$1\n${guardImport}`,
  );

  next = next.replace(
    /export async function (GET|POST)\(req: NextRequest\) \{\r?\n/g,
    (_match, method) =>
      `export async function ${method}(req: NextRequest) {\n  const access = await requireOsintAccess(req, "${segment}");\n  if (access instanceof NextResponse) return access;\n\n`,
  );

  return next;
}

for (const [rel, segment] of Object.entries(segmentByFile)) {
  const file = path.join(root, rel);
  const content = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, injectGuard(content, segment));
  console.log("guarded", rel);
}

const modulesHealth = path.join(root, "modules/health/route.ts");
let mh = fs.readFileSync(modulesHealth, "utf8");
if (!mh.includes("requireAuthenticatedSession")) {
  mh = mh.replace(
    'import { NextResponse } from "next/server";\n',
    'import { NextResponse } from "next/server";\n\nimport { requireAuthenticatedSession } from "@/lib/osint-api-auth";\n',
  );
  mh = mh.replace(
    "export async function GET() {\n  const now = Date.now();",
    "export async function GET() {\n  const session = await requireAuthenticatedSession();\n  if (session instanceof NextResponse) return session;\n\n  const now = Date.now();",
  );
  fs.writeFileSync(modulesHealth, mh);
  console.log("guarded modules/health");
}
