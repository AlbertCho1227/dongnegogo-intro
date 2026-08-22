import assert from "node:assert/strict";
import test from "node:test";

import { officialProgramAccess } from "../lib/official-program-access.ts";

test("공유누리와 서울시의 차단 가능 상세 링크는 공식 홈 검색으로 안내한다", () => {
  const eshare = officialProgramAccess("https://www.eshare.go.kr/UserPortal/Upv/UprResrcFacl/index.do?rsrc_no=CF09N0506858");
  assert.deepEqual(eshare, { href: "https://www.eshare.go.kr/", providerName: "공유누리", requiresHomepageSearch: true });

  const eshareApex = officialProgramAccess("https://eshare.go.kr/UserPortal/Upv/UprResrcFacl/index.do?rsrc_no=sample");
  assert.deepEqual(eshareApex, { href: "https://www.eshare.go.kr/", providerName: "공유누리", requiresHomepageSearch: true });

  const seoul = officialProgramAccess("https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=SAMPLE");
  assert.deepEqual(seoul, { href: "https://yeyak.seoul.go.kr/", providerName: "서울시 공공서비스예약", requiresHomepageSearch: true });
});

test("정상 상세 링크는 쿼리를 포함한 원래 주소로 바로 연결한다", () => {
  for (const href of [
    "https://share.gg.go.kr/vl/info?shareId=123",
    "https://tickets.interpark.com/goods/24000123",
    "https://snymca.org/program/swimming?month=8#apply",
  ]) {
    const access = officialProgramAccess(href);
    assert.equal(access?.requiresHomepageSearch, false);
    assert.equal(access?.href, href.replace(/#.*$/, ""));
  }
});

test("안전하지 않거나 잘못된 신청 주소는 링크로 만들지 않는다", () => {
  assert.equal(officialProgramAccess("http://www.eshare.go.kr/detail"), null);
  assert.equal(officialProgramAccess("javascript:alert(1)"), null);
  assert.equal(officialProgramAccess("https://user:pass@example.com/detail"), null);
  assert.equal(officialProgramAccess("not-a-url"), null);
});
