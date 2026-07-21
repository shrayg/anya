import {

  resolveDorkConfidence,

  searchIndexSweep,

} from "../lib/index-sweep/search.ts";

import { phoneSearchVariants } from "../lib/index-sweep/normalize.ts";

import { INDEX_SWEEP_PLATFORMS } from "../lib/index-sweep/platforms.ts";



function assert(cond: unknown, msg: string): asserts cond {

  if (!cond) throw new Error(msg);

}



console.log("== index sweep email ==");

const email = await searchIndexSweep({

  query: "indoshray@gmail.com",

  liveProbe: false,

});

console.log({

  kind: email.kind,

  dorks: email.dorks.length,

  exact: email.dorks.filter((d) => d.matchMode === "exact").length,

  loose: email.dorks.filter((d) => d.matchMode === "loose").length,

  linkedIn: email.dorks

    .filter((d) => d.platformId === "linkedin")

    .map((d) => ({ q: d.query, conf: d.confidence, mode: d.matchMode })),

});

assert(email.sources[0]?.label === "Index Sweep", "branded source");

assert(

  email.dorks.some((d) => d.query === '"indoshray@gmail.com" site:linkedin.com'),

  "linkedin email dork",

);

assert(

  email.dorks.some((d) => d.query === "indoshray@gmail.com site:instagram.com"),

  "instagram loose dork",

);

assert(

  email.dorks.some(

    (d) => d.query === "indoshray@gmail.com" && d.platformId === "open-web-loose",

  ),

  "open-web loose dork",

);



const loose = email.dorks.filter((d) => d.matchMode === "loose");



assert(loose.length > 0, "has loose leads");

assert(

  loose.every((d) => d.confidence === "low"),

  "loose starts low confidence",

);

assert(

  email.dorks.find((d) => d.platformId === "linkedin")?.confidence === "high",

  "linkedin exact high",

);

assert(

  email.dorks.find((d) => d.platformId === "github")?.confidence === "high",

  "github exact high",

);

assert(

  INDEX_SWEEP_PLATFORMS.every((p) =>

    email.dorks.some((d) => d.platformId === p.id && d.matchMode === "exact"),

  ),

  "all platforms covered for email",

);

assert(!JSON.stringify(email).toLowerCase().includes("sherlock"), "no leak");



console.log("== confidence rules ==");

assert(

  resolveDorkConfidence({

    matchMode: "loose",

    platformReliability: "high",

    corroborated: false,

  }) === "low",

  "loose+high platform = low",

);

assert(

  resolveDorkConfidence({

    matchMode: "loose",

    platformReliability: "high",

    corroborated: true,

  }) === "medium",

  "loose corroborated = medium max",

);

assert(

  resolveDorkConfidence({

    matchMode: "exact",

    platformReliability: "high",

    corroborated: false,

  }) === "high",

  "exact keeps platform reliability",

);



console.log("== index sweep phone ==");

const phone = await searchIndexSweep({

  query: "2025550123",

  liveProbe: false,

  kind: "phone",

});

const variants = phoneSearchVariants("2025550123");



console.log({

  kind: phone.kind,

  variants: phone.variants.length,

  dorks: phone.dorks.length,

  linkedInExact: phone.dorks.filter(

    (d) => d.platformId === "linkedin" && d.matchMode === "exact",

  ).length,

  sampleVariants: phone.variants.slice(0, 8),

});



assert(phone.kind === "phone", "phone kind");

assert(phone.variants.length === variants.length, "variants stored");

assert(phone.variants.length >= 15, "many format variants");

assert(

  phone.variants.includes("202-555-0123"),

  "dash format",

);

assert(

  phone.variants.includes("(202) 555-0123"),

  "paren format",

);

assert(

  phone.variants.includes("+1 (202) 555-0123") ||

    phone.variants.includes("+12025550123"),

  "e164-ish format",

);

assert(

  phone.dorks.filter(

    (d) => d.platformId === "linkedin" && d.matchMode === "exact",

  ).length === phone.variants.length,

  "linkedin has one strict dork per variant",

);

assert(

  phone.dorks.filter(

    (d) => d.platformId === "open-web" && d.matchMode === "exact",

  ).length === phone.variants.length,

  "open-web strict per variant",

);

assert(

  INDEX_SWEEP_PLATFORMS.every((p) =>

    phone.dorks.some(

      (d) =>

        d.platformId === p.id &&

        d.matchMode === "exact" &&

        d.query.includes(`site:${p.site}`),

    ),

  ),

  "all platforms get phone strict site: dorks",

);

assert(

  phone.dorks

    .filter((d) => d.matchMode === "loose")

    .every((d) => d.confidence === "low"),

  "phone loose stays low",

);



console.log("\nALL TESTS PASSED");

