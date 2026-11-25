import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer as createViteServer } from "vite";

const temp = mkdtempSync(path.join(os.tmpdir(), "jibkog-catalog-"));
const vite = await createViteServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { createAppApi } = await vite.ssrLoadModule("/server/api/app.ts");
let requests = 0;
let geocodes = 0;
const fakeFetch = async (input) => {
  requests++;
  const url = new URL(input);
  if (url.pathname.endsWith("getAPTLttotPblancDetail")) {
    assert.equal(url.searchParams.get("returnType"), "JSON");
    assert.ok(url.searchParams.get("cond[RCRIT_PBLANC_DE::GTE]"));
    const region = url.searchParams.get("cond[SUBSCRPT_AREA_CODE_NM::EQ]");
    const data = region === "서울" ? Array.from({ length: 40 }, (_, index) => ({
      HOUSE_MANAGE_NO: `2026${String(index).padStart(6, "0")}`, PBLANC_NO: `2026${String(index).padStart(6, "0")}`,
      HOUSE_NM: `테스트 단지 ${index}`, HSSPLY_ADRES: "서울특별시 영등포구 문래동 27-1 일원",
      RCRIT_PBLANC_DE: "2026-11-01", RCEPT_BGNDE: "2026-11-23", RCEPT_ENDDE: "2026-11-26",
      TOT_SUPLY_HSHLDCO: 100, MVN_PREARNGE_YM: "203003",
    })) : [];
    return Response.json({ data, matchCount: data.length });
  }
  if (url.pathname.endsWith("getAPTLttotPblancMdl")) {
    const house = url.searchParams.get("cond[HOUSE_MANAGE_NO::EQ]");
    const notice = url.searchParams.get("cond[PBLANC_NO::EQ]");
    assert.equal(house, notice);
    return Response.json({ data: [{ HOUSE_MANAGE_NO: house, PBLANC_NO: notice, MODEL_NO: "01", HOUSE_TY: "084.9409A", SUPLY_AR: "109.7007", LTTOT_TOP_AMOUNT: "182700", SUPLY_HSHLDCO: 51, SPSPLY_HSHLDCO: 59 }], matchCount: 1 });
  }
  if (url.pathname.endsWith("/v2/local/search/address.json")) {
    geocodes++;
    assert.equal(url.searchParams.get("query"), "서울특별시 영등포구 문래동 27-1");
    return Response.json({ documents: [{ x: "126.9", y: "37.51", address_name: "서울 영등포구 문래동 27-1" }] });
  }
  throw new Error("unexpected request");
};

async function serve(app) {
  const server = createHttpServer((req, res) => { void app.middleware(req, res, () => { res.statusCode = 404; res.end(); }); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
async function get(base, url) {
  const response = await fetch(base + url);
  assert.equal(response.status, 200, `${url}: ${response.status}`);
  return response.json();
}
async function post(base, url, body, cookie) {
  const response = await fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, json: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function close(server) { await new Promise((resolve) => server.close(resolve)); }

try {
  const dataFile = path.join(temp, "live", "jibkog.json");
  const catalogTest = { keys: { applyhome: "dummy", kakao: "dummy" }, fetchImpl: fakeFetch, minIntervalMs: 0 };
  const live = createAppApi({ dataFile, catalogTest });
  const first = await serve(live);
  const page = await get(first.base, "/api/catalog/complexes?q=%ED%85%8C%20%EC%8A%A4%20%ED%8A%B8&region=%EC%84%9C%EC%9A%B8");
  assert.equal(page.total, 40);
  assert.equal((await get(first.base, "/api/catalog/complexes?q=%EC%98%81%20%EB%93%B1%20%ED%8F%AC")).total, 40);
  assert.equal((await get(first.base, "/api/catalog/complexes?region=%EA%B2%BD%EA%B8%B0")).total, 0);
  assert.equal((await get(first.base, "/api/catalog/complexes?page=2")).items.length, 20);
  const detail = await get(first.base, `/api/catalog/complexes/${page.items[0].id}`);
  assert.equal(detail.complex.housingTypes[0].exclusiveAreaM2, 84.9409);
  assert.equal(detail.complex.housingTypes[0].maxPriceWon, 1_827_000_000);
  const notices = await get(first.base, "/api/catalog/notices?status=open");
  assert.equal(notices.notices.length, 40);
  const listings = await get(first.base, "/api/listings");
  const examples = listings.listings.filter((listing) => listing.catalogComplexId);
  assert.equal(examples.length, 40);
  assert.ok(examples.every((listing) => listing.isDemo && listing.trust?.score >= 70 && listing.salePrice === 1_827_000_000));
  assert.equal(geocodes, 1);
  const markers = await get(first.base, "/api/map/markers?bounds=37.4,126.8,37.7,127.2");
  assert.equal(markers.markers.filter((marker) => marker.kind === "notice").length, 40);
  assert.equal(markers.markers.filter((marker) => marker.kind === "listing" && marker.isDemo && marker.complexId.startsWith("catalog-")).length, 40);
  const loggedIn = await post(first.base, "/api/auth/login", { email: "seller1@jibkog.dev", password: "jibkog-demo-1234" });
  assert.equal(loggedIn.status, 200);
  const listingBody = {
    catalogComplexId: detail.complex.id, housingModelNumber: "01", area: 109.7007, floor: 12,
    salePrice: 1_827_000_000, premium: 100_000_000, optionCost: 0, paidAmount: 400_000_000,
    description: "계약 서류를 확인할 수 있는 매물입니다.",
    documents: [{ type: "salesContract", status: "verified" }],
    verification: {
      contract: { mode: "demo", result: { complexName: detail.complex.name, exclusiveArea: 109.7007, salePrice: 1_827_000_000, contractorName: loggedIn.json.user.realName, contractDate: null, confidence: 0.9, forgeryNotes: [] } },
      screening: { mode: "demo", result: { findings: [] } },
    },
  };
  const registered = await post(first.base, "/api/listings", listingBody, loggedIn.cookie);
  assert.equal(registered.status, 201);
  assert.equal(registered.json.listing.complexId, `catalog-${detail.complex.id}`);
  assert.equal(registered.json.listing.housingModelNumber, "01");
  assert.equal(registered.json.listing.isDemo, false);
  assert.equal((await post(first.base, "/api/listings", { ...listingBody, housingModelNumber: "99" }, loggedIn.cookie)).status, 400);
  assert.equal((await post(first.base, "/api/listings", { ...listingBody, salePrice: 1_827_010_000 }, loggedIn.cookie)).status, 400);
  const calls = requests;
  await close(first.server);

  const reused = createAppApi({ dataFile, catalogTest: { ...catalogTest, fetchImpl: async () => { throw new Error("cache was not reused"); } } });
  const second = await serve(reused);
  assert.equal((await get(second.base, "/api/catalog/complexes")).total, 40);
  assert.equal((await get(second.base, "/api/listings")).listings.filter((listing) => listing.catalogComplexId && listing.isDemo).length, 40);
  assert.equal(requests, calls);
  await close(second.server);

  const noKeys = createAppApi({ dataFile: path.join(temp, "fixture", "jibkog.json"), catalogTest: { keys: { applyhome: null, kakao: null }, fetchImpl: async () => { throw new Error("keyless mode requested network"); } } });
  const third = await serve(noKeys);
  assert.equal((await get(third.base, "/api/catalog/complexes?q=%EB%AC%B8%EB%9E%98")).total, 1);
  assert.equal((await get(third.base, "/api/catalog/complexes")).total, 5);
  await close(third.server);

  const cacheFile = path.join(temp, "live", "catalog.json");
  const cache = JSON.parse(readFileSync(cacheFile, "utf8"));
  cache.fetchedAt = "2000-01-01T00:00:00.000Z";
  writeFileSync(cacheFile, JSON.stringify(cache));
  const stale = createAppApi({ dataFile, catalogTest: { ...catalogTest, fetchImpl: async () => { throw new Error("network unavailable"); } } });
  const fourth = await serve(stale);
  assert.equal((await get(fourth.base, "/api/catalog/complexes")).total, 40);
  await close(fourth.server);
  console.log(JSON.stringify({ liveNotices: 40, examples: 40, area: 84.9409, maxPriceWon: 1_827_000_000, geocodeCalls: geocodes, cacheReused: true, fixture: 5, staleFallback: 40 }));
} finally {
  await vite.close();
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
  rmSync(temp, { recursive: true, force: true });
}
