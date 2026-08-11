import type { Metadata } from "next";
import { Callout, DataTable, LegalMeta, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "공공데이터·공공누리 이용정책 | 동네고고",
  description: "동네고고의 공공데이터 출처, 공공누리 공식 마크와 유형별 이용조건, 사진·포스터 표시 원칙을 안내합니다.",
  alternates: { canonical: "/public-data" },
};

const KOGL_POLICY_URL = "https://www.kogl.or.kr/info/license.do";

const sourceLink = (label: string, href: string) => (
  <a href={href} target="_blank" rel="noreferrer">{label}</a>
);

function KoglMark({ type, condition }: { type: 1 | 2 | 3 | 4; condition: string }) {
  return (
    <a className="kogl-mark-link" href={KOGL_POLICY_URL} target="_blank" rel="noreferrer" aria-label={`공공누리 제${type}유형: ${condition} — 공식 유형 안내 열기`}>
      {/* 공공누리에서 내려받은 공식 파일명과 원본 비율을 그대로 유지합니다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="kogl-mark" src={`/legal/kogl/number${type}.jpg`} alt={`공공누리 제${type}유형 ${condition}`} loading="lazy" />
    </a>
  );
}

export default function PublicDataPage() {
  return (
    <LegalPage eyebrow="출처와 저작권" title="공공데이터·공공누리 이용정책" description="데이터를 공개한 기관과 저작자의 권리를 존중하고, 확인된 이용조건과 출처를 프로그램·사진 가까이에 표시합니다.">
      <LegalMeta>최종 점검일 2026년 8월 12일 · 각 데이터셋·저작물 원문에 표시된 최신 이용조건이 이 안내보다 우선합니다.</LegalMeta>

      <LegalSection title="1. 현재 사용하는 주요 출처와 적용 기준">
        <DataTable headers={["출처", "주요 정보", "동네고고 적용 기준"]} rows={[
          [sourceLink("공유누리·행정안전부 공공개방자원", "https://www.data.go.kr/data/15076179/openapi.do"), "교육·강좌, 체육·문화시설, 상세정보와 API 제공 사진", "공공데이터포털에 표시된 ‘이용허락범위 제한 없음’을 기준으로 제공기관·자원명·원문 링크를 유지. 숙박 자원은 수집·제공 대상에서 제외"],
          [sourceLink("서울 열린데이터광장·서울시 공공서비스예약", "https://data.seoul.go.kr/etc/openInfo.do"), "생활체육, 공공예약, 문화행사, 평생학습, 50플러스, 1인가구, 세종문화회관, 체육시설·주차", "API 또는 개별 저작물에 실제 부착된 유형을 적용. 공공누리가 없는 자료는 재배포 가능으로 임의 판단하지 않고 원문 링크·출처를 우선 제공"],
          [sourceLink("공공데이터포털", "https://www.data.go.kr/ugs/selectPortalPolicyView.do"), "전국평생학습강좌 표준데이터, 문화·시설·교통·안전 데이터", "데이터셋별 이용허락범위와 제3자 권리를 확인하고 데이터셋명·원천기관을 함께 표시"],
          [sourceLink("한국문화정보원 문화데이터광장", "https://www.culture.go.kr/data/contest/info.do"), "문화행사·시설·공연·전시와 공공누리 사진", "공공누리 유형이 명시된 저작물만 해당 유형으로 표시. 제공기관·저작물명·저작자(표시된 경우)·원문 링크를 보존"],
          [sourceLink("재난안전데이터공유플랫폼·행정안전부", "https://www.data.go.kr/data/15138456/openapi.do"), "무더위쉼터", "공공데이터포털의 ‘이용허락범위 제한 없음’을 기준으로 제공기관과 데이터셋 출처를 표시"],
          [sourceLink("경기문화재단·경기데이터드림", "https://data.gg.go.kr/portal/termsPolicyPage.do"), "전시·교육·문화행사", "경기도 공공데이터 사용 결과임을 표시하고, 제3자 저작물은 그 권리자의 개별 조건을 우선 적용"],
          ["Kakao·Naver·Apple 지도 및 교통 API", "좌표 변환, 지도, 경로, 버스·지하철·열차", "프로그램 원천자료가 아닌 보조 서비스. 각 SDK가 제공하는 로고·저작권·축척 표시는 가리거나 제거하지 않음"],
          ["AI 쉬운 설명", "공식 공고를 이해하기 쉽게 요약", "원문 사실관계를 유지하고 공식 원문을 함께 제공. 공공누리 AI유형을 일반 서비스 재사용 허락으로 확대 해석하지 않음"],
        ]} />
      </LegalSection>

      <LegalSection title="2. 공공누리 공식 마크와 1~4유형">
        <DataTable headers={["공식 마크", "출처 표시", "상업적 이용", "변경·2차 저작"]} rows={[
          [<KoglMark key="kogl-1" type={1} condition="출처표시" />, "필수", "가능", "가능"],
          [<KoglMark key="kogl-2" type={2} condition="출처표시·상업적 이용금지" />, "필수", "불가", "가능"],
          [<KoglMark key="kogl-3" type={3} condition="출처표시·변경금지" />, "필수", "가능", "불가"],
          [<KoglMark key="kogl-4" type={4} condition="출처표시·상업적 이용금지·변경금지" />, "필수", "불가", "불가"],
        ]} />
        <Callout>위 이미지는 공공누리 공식 유형 마크입니다. 동네고고는 개별 자료에 실제로 지정된 유형만 표시하며, ‘이용허락범위 제한 없음’을 공공누리 제1유형으로 바꿔 표시하지 않습니다. 제0유형은 출처표시 조건 없이 자유이용할 수 있고, AI유형은 인공지능 학습 목적의 별도 조건이므로 일반 앱·웹 표시에는 해당 저작물의 일반 공공누리 유형을 적용합니다.</Callout>
      </LegalSection>

      <LegalSection title="3. 출처·저작권 표시 방식">
        <ul>
          <li><strong>프로그램:</strong> 상세 화면에 “출처: 제공기관 또는 데이터셋명”을 표시하고 가능한 경우 공식 신청·원문 링크를 함께 제공합니다.</li>
          <li><strong>사진·포스터:</strong> 사진 가까이에 제공기관·저작자, 확인된 공공누리 유형 또는 라이선스, 원문 링크를 표시합니다. 유형이 확인되지 않은 자료에는 공공누리 마크를 붙이지 않습니다.</li>
          <li><strong>공공누리 출처표시:</strong> 확인 가능한 범위에서 기관명, 작성연도, 저작물명, 작성자명과 기관 홈페이지 링크를 표시합니다. 제공기관이 동네고고를 후원하거나 특별한 관계가 있는 것으로 오인시키는 표현은 사용하지 않습니다.</li>
          <li><strong>변경금지 유형:</strong> 내용·형식 변경, 번역·편곡·각색·합성·영상화 등 2차적 저작물 작성을 하지 않습니다. 기술적 표시 크기 조정도 원본 의미와 저작인격권을 해치지 않는 범위로 제한합니다.</li>
          <li><strong>비상업 유형:</strong> 광고·유료 기능·제휴 등 영리행위와 직·간접 관련될 수 있는 화면에서는 사용하지 않거나 원천기관의 별도 서면 허락을 먼저 받습니다.</li>
          <li><strong>제3자 권리:</strong> 초상권, 개인정보, 상표·디자인·특허, 제3자 저작권이 포함되면 공공데이터 공개 여부와 별개로 필요한 허락을 확인합니다.</li>
          <li><strong>라이선스 미확인:</strong> 자유이용 가능으로 추정하지 않으며, 신규 미디어는 검증 전 공개하지 않고 공식 원문 링크 제공을 우선합니다.</li>
        </ul>
        <p>표시 예시: <em>“본 저작물은 한국문화정보원에서 2026년 작성하여 공공누리 제1유형으로 개방한 ‘○○(작성자: ○○)’을 이용하였으며, 원문은 해당 기관 홈페이지에서 확인할 수 있습니다.”</em></p>
      </LegalSection>

      <LegalSection title="4. 이미지·포스터 권리 검증">
        <p>시설·프로그램 미디어에는 제공자, 출처 문구, 라이선스명, 라이선스 링크, 원문 링크, 이미지 해시와 검증 상태를 보관할 수 있습니다. iOS·Android·앱인토스는 값이 있는 사진에 출처와 라이선스를 함께 표시하며, 같은 이미지는 해시와 주소로 중복을 제거합니다.</p>
        <p>한국문화정보원의 디지털 문화자원은 <strong>공공누리 제1유형이 명시된 이미지</strong>만 허용 목록에 포함합니다. 한국관광공사 관광사진 API의 사진은 해당 데이터셋에 표시된 공공누리 제1유형 조건을 적용합니다. 문화시설 API와 공유누리 상세 API처럼 이용허락범위가 ‘제한 없음’으로 확인된 데이터는 그 문구와 원천기관을 표시하되 공공누리 유형을 임의로 부여하지 않습니다.</p>
        <p>서울시·문화기관의 프로그램 포스터처럼 원천 API에 라이선스 유형이 없는 경우에는 제공기관과 원문을 표시하고, 별도 이용조건이 확인되기 전까지 공공누리 마크를 표시하지 않습니다. 권리 확인이 되지 않은 외부 검색·블로그·SNS 이미지는 수집 대상으로 사용하지 않습니다.</p>
      </LegalSection>

      <LegalSection title="5. 정제·요약과 정확성">
        <p>동네고고는 원문을 임의로 대체하지 않고 형식 정리, 기간 판정, 중복 통합, 숙박 제외, 카테고리 분류를 수행합니다. AI 쉬운 설명은 원문의 사실관계를 유지하도록 생성하지만 오류 가능성이 있어 공식 원문을 함께 제공합니다. 출처·이용조건 메타데이터는 원천 자료와 함께 갱신하며, 조건 변경 또는 철회가 확인되면 표시·공개 상태를 재검토합니다.</p>
      </LegalSection>

      <LegalSection title="6. 권리 침해·정정 요청">
        <p>권리자 또는 제공기관은 저작물명, 원문 주소, 권리 근거와 요청 내용을 <a href="mailto:forestieum@gmail.com?subject=%EB%8F%99%EB%84%A4%EA%B3%A0%EA%B3%A0%20%EA%B3%B5%EA%B3%B5%EB%8D%B0%EC%9D%B4%ED%84%B0%20%EA%B6%8C%EB%A6%AC%20%EC%9A%94%EC%B2%AD">forestieum@gmail.com</a>으로 보낼 수 있습니다. 확인 중에는 해당 미디어를 숨기고, 침해 또는 조건 위반이 확인되면 삭제·표시 수정·재배포 중단을 진행합니다.</p>
        <p>공식 기준은 {sourceLink("공공누리 유형안내", KOGL_POLICY_URL)}, {sourceLink("공공데이터포털 정책", "https://www.data.go.kr/ugs/selectPortalPolicyView.do")}, {sourceLink("서울 열린데이터광장 저작권 정보", "https://data.seoul.go.kr/etc/openInfo.do")}에서 확인할 수 있습니다.</p>
      </LegalSection>

      <Callout>이 문서는 확인된 공개 이용조건을 서비스에 반영하기 위한 운영 기준이며 개별 저작물의 권리관계를 대신 확정하지 않습니다. 원천기관의 최신 고지 또는 권리자의 요청이 있으면 그 조건을 우선 적용합니다.</Callout>
    </LegalPage>
  );
}
