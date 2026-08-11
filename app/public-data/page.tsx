import type { Metadata } from "next";
import { Callout, DataTable, LegalMeta, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "공공데이터 이용정책 | 동네고고",
  description: "동네고고의 공공데이터 출처, 공공누리 유형별 이용조건과 출처 표시 원칙을 안내합니다.",
  alternates: { canonical: "/public-data" },
};

const badge = (type: 1 | 2 | 3 | 4) => <span className={`kogl-badge kogl-${type}`}>공공누리 제{type}유형</span>;

export default function PublicDataPage() {
  return (
    <LegalPage eyebrow="출처와 저작권" title="공공데이터 이용정책" description="데이터를 공개한 기관의 권리를 존중하고, 이용조건과 출처를 프로그램·사진과 함께 표시합니다.">
      <LegalMeta>공개일 2026년 8월 11일 · 공공데이터포털 및 공공누리의 개별 데이터셋 이용조건이 이 정책보다 우선합니다.</LegalMeta>

      <LegalSection title="1. 현재 사용하는 주요 출처">
        <DataTable headers={["출처", "주요 정보", "표시·확인 원칙"]} rows={[
          ["공유누리", "교육·강좌, 체육시설, 문화 자원과 상세정보·공식 사진", "프로그램에 ‘공유누리’ 출처를 표시하고 해당 자원의 개별 이용조건을 확인. 숙박 자원은 수집·제공 대상에서 제외"],
          ["서울열린데이터광장·서울시 공공서비스예약", "생활체육, 공공예약, 문화행사, 평생학습, 50플러스, 1인가구, 세종문화회관, 체육시설, 주차", "각 API·저작물 상세 페이지의 이용허락범위와 서울시 출처를 유지"],
          ["공공데이터포털", "전국평생학습강좌 표준데이터, 문화정보·문화시설, 교통 등", "데이터셋별 공공누리·제3자 권리 표시를 확인하고 원천기관명을 함께 표시"],
          ["한국문화정보원 문화공공데이터광장", "문화행사·시설·공연·전시와 공공누리 사진", "제공기관·저작물명·공공누리 유형을 사진 또는 설명 가까이에 표시"],
          ["재난안전데이터공유플랫폼", "행정안전부 무더위쉼터", "행정안전부·재난안전데이터공유플랫폼 출처와 원문 링크 표시"],
          ["경기문화재단", "전시·교육·문화행사", "공식 게시물 원문 링크를 유지하고 사이트 이용조건·로봇 정책 범위에서 저빈도로 갱신"],
          ["Kakao·Apple 지도 및 공공 교통 API", "좌표 변환, 지도, 경로, 버스·지하철·열차", "공공 프로그램 원천이 아닌 지도·교통 보조 출처로 별도 표시"],
        ]} />
      </LegalSection>

      <LegalSection title="2. 공공누리 1~4유형 적용 기준">
        <DataTable headers={["유형", "출처 표시", "상업적 이용", "변경·2차 저작"]} rows={[
          [badge(1), "필수", "가능", "가능"],
          [badge(2), "필수", "불가", "가능"],
          [badge(3), "필수", "가능", "불가"],
          [badge(4), "필수", "불가", "불가"],
        ]} />
        <Callout>동네고고는 “공공데이터”라는 이유만으로 자유 이용이 가능하다고 간주하지 않습니다. 제3자 저작권, 초상권, 개별 API 이용조건이 있으면 그 조건을 먼저 적용합니다.</Callout>
      </LegalSection>

      <LegalSection title="3. 출처·티커 표시 방식">
        <ul>
          <li><strong>프로그램:</strong> 상세 화면에 “출처: 제공기관 또는 데이터셋명”을 표시하고 가능한 경우 공식 신청·원문 링크를 함께 제공합니다.</li>
          <li><strong>사진·포스터:</strong> 사진 가까이에 제공기관·저작자, 공공누리 유형 또는 라이선스, 원문 링크를 표시합니다. 여러 API에서 같은 이미지가 오면 해시와 주소로 중복을 제거합니다.</li>
          <li><strong>변경금지 유형:</strong> 비율 유지와 기술적 리사이즈 외에 내용을 편집·합성하지 않으며, 설명 생성의 근거 이미지로 사용하더라도 변형 저작물을 만들지 않습니다.</li>
          <li><strong>비상업 유형:</strong> 광고·유료 기능·제휴 등 상업적 이용 가능성이 있는 화면에서는 사용하지 않거나 원천기관의 별도 허락을 먼저 받습니다.</li>
          <li><strong>라이선스 미확인:</strong> 확인 전에는 신규 사진을 공개하지 않고, 공식 원문 링크만 제공하는 것을 기본으로 합니다.</li>
        </ul>
        <p>권장 표시 예시: <em>“출처: 한국문화정보원 문화공공데이터광장, 저작물명 ○○, 공공누리 제1유형”</em></p>
      </LegalSection>

      <LegalSection title="4. 현재 데이터베이스의 권리 메타데이터">
        <p>동네고고는 시설·프로그램 미디어에 제공자, 출처 문구, 라이선스명, 라이선스 링크, 원문 링크, 이미지 해시와 권리 검증 상태를 저장할 수 있도록 구성했습니다. 앱(iOS·Android·앱인토스)은 값이 있는 사진에 출처와 라이선스를 함께 표시합니다.</p>
        <p>한국문화정보원의 공공 사진 카탈로그는 현재 <strong>공공누리 제1유형(출처표시)</strong> 메타데이터를 보존하고 있습니다. 반면 일부 프로그램 포스터는 원천 API에 라이선스 필드가 없어 공식 원문·제공기관 기준으로 추가 검증이 필요합니다.</p>
      </LegalSection>

      <LegalSection title="5. 정제·요약과 정확성">
        <p>동네고고는 원문을 임의로 대체하지 않고 형식 정리, 기간 판정, 중복 통합, 숙박 제외, 카테고리 분류를 수행합니다. AI 쉬운 설명은 원문의 사실관계를 유지하도록 생성하지만 오류 가능성이 있어 항상 공식 원문을 함께 제공합니다.</p>
      </LegalSection>

      <LegalSection title="6. 권리 침해·정정 요청">
        <p>권리자 또는 제공기관은 저작물명, 원문 주소, 권리 근거와 요청 내용을 <a href="mailto:forestieum@gmail.com?subject=%EB%8F%99%EB%84%A4%EA%B3%A0%EA%B3%A0%20%EA%B3%B5%EA%B3%B5%EB%8D%B0%EC%9D%B4%ED%84%B0%20%EA%B6%8C%EB%A6%AC%20%EC%9A%94%EC%B2%AD">이메일</a>로 보낼 수 있습니다. 확인 중에는 해당 미디어를 숨기고, 침해 또는 조건 위반이 확인되면 삭제·표시 수정·재배포 중단을 진행합니다.</p>
        <p>공식 유형 설명은 <a href="https://www.data.go.kr/ugs/selectPortalPolicyView.do" target="_blank" rel="noreferrer">공공데이터포털 정책</a>과 <a href="https://www.kogl.or.kr" target="_blank" rel="noreferrer">공공누리</a>에서 확인할 수 있습니다.</p>
      </LegalSection>
    </LegalPage>
  );
}
