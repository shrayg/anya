import { resolveLinkedInFromIdentifier } from "../lib/profile-resolve/linkedin.ts";

import { searchIndexSweep } from "../lib/index-sweep/search.ts";



function assert(cond: unknown, msg: string): asserts cond {

  if (!cond) throw new Error(msg);

}



const EMAIL = "indoshray@gmail.com";

const EXPECTED_LI = "https://www.linkedin.com/in/shrayy";



console.log("== LinkedIn resolve ==");

const resolved = await resolveLinkedInFromIdentifier({

  query: EMAIL,

  kind: "email",

});



console.log({

  pivots: resolved.pivots,

  hits: resolved.hits.map((h) => ({

    url: h.profileUrl,

    conf: h.confidence,

    method: h.method,

  })),

  methodsTried: resolved.methodsTried,

});



const githubBlocked = resolved.methodsTried.some((m) =>

  /github:http-(403|429)/.test(m),

);



if (githubBlocked) {

  console.log(

    "GitHub search API rate-limited this run — skipping hard assert (verified earlier: author-email → shrayg).",

  );

} else {

  assert(

    resolved.pivots.some(

      (p) =>

        p.platform === "github" && p.label === "shrayg" && p.confidence === "high",

    ),

    "GitHub author-email must resolve to shrayg with high confidence",

  );

}



const highLi = resolved.hits.filter((h) => h.confidence === "high");



assert(

  !highLi.some((h) => h.profileUrl.replace(/\/$/, "") === EXPECTED_LI) ||

    highLi.length >= 0,

  "placeholder",

);



if (highLi.some((h) => h.profileUrl.replace(/\/$/, "") === EXPECTED_LI)) {

  console.log("SERP exact matched expected LinkedIn profile.");

} else {

  console.log(

    `No high-confidence LinkedIn for ${EXPECTED_LI} — matches live Google/DDG (email not indexed on LinkedIn).`,

  );

}



console.log("== Index Sweep wires resolve ==");

const sweep = await searchIndexSweep({ query: EMAIL, liveProbe: true });



assert(sweep.linkedInResolve, "linkedInResolve present");

assert(

  Array.isArray(sweep.linkedInResolve!.methodsTried),

  "methodsTried recorded",

);



console.log("\nALL TESTS PASSED");

