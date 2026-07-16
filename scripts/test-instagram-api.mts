const INSTAGRAM_APP_ID = "936619743392459";
const FOLLOWERS_QUERY_HASH = "37479f2b8209594dde7facb0d904896a";
const FOLLOWING_QUERY_HASH = "58712303d941c6855d4e888c5f0cd22f";

function igHeaders(referer = "https://www.instagram.com/") {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-ig-app-id": INSTAGRAM_APP_ID,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    Referer: referer,
  };
}

async function fetchProfile(username: string) {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const response = await fetch(url, { headers: igHeaders(`https://www.instagram.com/${username}/`) });
  const text = await response.text();
  console.log("profile status", response.status, "len", text.length);
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    const user = data?.data?.user;
    console.log("profile user", user?.id, user?.username, user?.is_private, user?.edge_followed_by?.count);
    return user;
  } catch {
    console.log("profile parse failed", text.slice(0, 200));
    return null;
  }
}

async function fetchGraphqlList(userId: string, queryHash: string, field: "edge_followed_by" | "edge_follow") {
  const variables = {
    id: userId,
    include_reel: true,
    fetch_mutual: false,
    first: 24,
  };
  const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
  const response = await fetch(url, { headers: igHeaders() });
  const text = await response.text();
  console.log(`${field} status`, response.status, "len", text.length);
  if (!text) return;
  try {
    const data = JSON.parse(text);
    const edges = data?.data?.user?.[field]?.edges ?? [];
    const pageInfo = data?.data?.user?.[field]?.page_info;
    console.log(`${field} count`, edges.length, "has_next", pageInfo?.has_next_page);
    if (edges[0]) console.log("first user", edges[0].node?.username);
    if (data?.message) console.log("message", data.message);
    if (data?.errors) console.log("errors", data.errors);
  } catch {
    console.log(`${field} parse failed`, text.slice(0, 300));
  }
}

const username = process.argv[2] ?? "natgeo";
const user = await fetchProfile(username);
if (user?.id) {
  await fetchGraphqlList(user.id, FOLLOWERS_QUERY_HASH, "edge_followed_by");
  await fetchGraphqlList(user.id, FOLLOWING_QUERY_HASH, "edge_follow");
}
