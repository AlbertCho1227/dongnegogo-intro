import type { Metadata } from "next";
import { Callout, DataTable, Flow, LegalMeta, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 동네고고",
  description: "동네고고가 처리하는 개인정보의 항목, 목적, 보유기간과 이용자 권리를 안내합니다.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="개인정보 보호" title="개인정보처리방침" description="동네고고는 필요한 정보만 처리하고, 계정과 위치 정보의 흐름을 숨김없이 설명합니다.">
      <LegalMeta>공개일 2026년 8월 11일 · 「개인정보 보호법」 제30조 기준 준비본 · 정식 시행일은 출시 전에 고지합니다.</LegalMeta>

      <LegalSection title="1. 처리 원칙과 책임자">
        <p>동네고고 운영자는 서비스 제공에 필요한 최소한의 개인정보만 처리하며 목적이 끝난 정보는 지체 없이 삭제합니다. 개인정보 보호 관련 문의·열람·정정·삭제·처리정지 요청은 <a href="mailto:forestieum@gmail.com">forestieum@gmail.com</a>에서 접수합니다.</p>
        <Callout>개인정보 보호책임자의 이름, 운영자의 법적 명칭·주소·전화번호는 정식 출시 전에 확정하여 이 문서에 공개합니다.</Callout>
      </LegalSection>

      <LegalSection title="2. 인증과 사용자 데이터 흐름">
        <Flow label="소셜 로그인 데이터 흐름" steps={[
          { title: "로그인 선택", body: "이용자가 Apple·Google·Kakao 중 하나를 직접 선택합니다." },
          { title: "제공자 인증", body: "각 제공자가 본인을 확인하고 OAuth/OIDC 토큰을 발급합니다." },
          { title: "Supabase Auth", body: "서울 리전에서 토큰을 검증하고 동네고고 사용자 UUID를 만듭니다." },
          { title: "본인 데이터 연결", body: "RLS 정책이 후기·찜·가족·알림을 로그인한 본인에게만 연결합니다." },
        ]} />
        <p>현재 데이터베이스에서 Apple·Google 로그인은 제공자 식별자와 이메일을, Kakao 로그인은 제공자 식별자를 사용합니다. 동네고고는 소셜 로그인 비밀번호를 수집하지 않습니다.</p>
      </LegalSection>

      <LegalSection title="3. 처리하는 개인정보">
        <DataTable headers={["구분", "항목", "목적", "보유기간"]} rows={[
          ["계정", "사용자 UUID, 로그인 제공자, 제공자 식별자, Apple·Google 이메일, 인증 세션", "로그인, 본인 식별, 계정 보안", "회원 탈퇴 또는 계정 삭제 시까지. 세션은 로그아웃·만료·탈퇴 시 종료"],
          ["이용자 콘텐츠", "후기·댓글 본문, 익명 표시명, 사진, 작성·수정 시각", "게시, 신고 대응, 작성자 권리 행사", "작성자가 삭제하거나 계정 삭제 시까지. 법령상 보존 필요 시 분리 보관"],
          ["개인 기능", "찜한 프로그램, 오픈런 알림 시점", "찜·알림 동기화", "이용자가 삭제하거나 계정 삭제 시까지"],
          ["가족 도우미", "가족 호칭·이름, 연령대, 관심 지역", "가족 맞춤 탐색", "이용자가 삭제하거나 계정 삭제 시까지"],
          ["시설 사진 제보", "제출자 UUID, 사진, 파일명, 시설, 설명, 동의 기록", "권리 확인, 검수, 게시", "검수 종료 또는 철회·계정 삭제 시까지. 게시된 사진은 권리관계 확인 후 처리"],
          ["위치·경로", "현재 좌표, 지도 범위, 목적지, 계산된 경로", "주변 프로그램, 거리·길찾기", "단말 메모리는 이용 중 처리. 서버 경로 캐시는 2~6시간 후 만료되고 15분마다 삭제"],
          ["로컬 기기", "기기 내 임의 식별자, 최근 검색·열람, 캐시, 화면 설정", "비로그인 이용과 성능 개선", "앱 삭제·기기 설정 초기화 또는 이용자 삭제 시까지"],
          ["접속 정보", "IP, 사용자 에이전트, 요청 시각, 오류·보안 로그", "보안, 장애 대응, 부정 이용 방지", "운영자가 별도 분석·광고 추적 로그를 만들지 않으며 호스팅 사업자의 필수 로그 정책에 따름"],
        ]} />
      </LegalSection>

      <LegalSection title="4. 수집 방법과 선택권">
        <ul>
          <li>소셜 로그인 제공자가 이용자 동의에 따라 인증 결과를 전달합니다.</li>
          <li>후기, 댓글, 사진, 가족 정보, 찜, 알림은 이용자가 직접 입력하거나 선택합니다.</li>
          <li>위치는 별도 위치기반서비스 동의와 운영체제 권한을 받은 경우에만 이용하며 권한을 거부해도 기본 지역으로 공개 정보를 탐색할 수 있습니다.</li>
          <li>소개 웹사이트에는 광고·행동분석 SDK를 넣지 않으며 필수 서비스 제공 외 추적 쿠키를 사용하지 않습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. 제3자 서비스와 처리위탁">
        <DataTable headers={["업체·서비스", "역할", "처리될 수 있는 정보", "위치·비고"]} rows={[
          ["Supabase, Inc.", "데이터베이스, 인증, 파일 저장, 서버 함수", "계정 식별자·이메일, 사용자 콘텐츠, 찜·가족·알림, 단기 경로 캐시", "주 데이터베이스·스토리지는 서울 리전. 운영·지원 과정의 국외 처리 가능성은 계약 및 하위처리자 정책에 따름"],
          ["Kakao Corp.", "Kakao 로그인, 지도·장소·경로", "Kakao 인증 정보, 길찾기 요청 좌표", "대한민국. 길찾기 요청에는 동네고고 계정 ID를 함께 보내지 않음"],
          ["Google LLC", "Google 로그인", "Google 제공자 식별자·이메일과 인증 토큰", "이용자가 Google 로그인을 선택한 때 네트워크로 전송"],
          ["Apple Inc.", "Apple 로그인", "Apple 제공자 식별자·이메일과 인증 토큰", "이용자가 Apple 로그인을 선택한 때 네트워크로 전송"],
          ["Cloudflare, Inc. 및 사이트 호스팅 제공자", "웹 전송, 보안, 캐시", "IP, 사용자 에이전트, 요청·오류 정보", "웹 접속 시 처리. 동네고고 웹은 별도 광고 추적을 하지 않음"],
          ["국가대중교통정보센터·공공 교통 API", "대중교통 정보", "출발·도착 주변 정류장·역 검색값", "계정 식별자를 보내지 않음"],
        ]} />
        <p>각 로그인 제공자의 정책은 <a href="https://privacy.kakao.com/policy?lang=ko" target="_blank" rel="noreferrer">Kakao</a>, <a href="https://policies.google.com/privacy?hl=ko" target="_blank" rel="noreferrer">Google</a>, <a href="https://www.apple.com/kr/legal/privacy/" target="_blank" rel="noreferrer">Apple</a>에서 확인할 수 있습니다. 국외 처리의 구체적인 수탁자·국가·보유기간은 정식 출시 전에 계약 현황을 확정하여 갱신합니다.</p>
      </LegalSection>

      <LegalSection title="6. 파기와 보호조치">
        <p>삭제 대상은 복구하기 어려운 방법으로 데이터베이스에서 제거하고, 파일은 저장소에서 삭제합니다. 법령상 보존 의무가 있으면 별도 분리해 해당 기간 동안만 보관합니다. 인증·사용자 데이터는 행 수준 보안(RLS), 최소 권한, 전송구간 암호화, 비밀키 분리, 접근 기록과 정기 백업으로 보호합니다.</p>
      </LegalSection>

      <LegalSection title="7. 이용자의 권리와 행사방법">
        <p>이용자는 본인의 개인정보 열람·정정·삭제·처리정지·동의 철회를 요청할 수 있습니다. 앱의 내 정보·작성 콘텐츠 기능 또는 <a href="/account-deletion">계정·데이터 삭제 페이지</a>를 이용하거나 이메일로 요청할 수 있습니다. 대리인이 요청할 때에는 관계와 위임을 확인할 수 있습니다.</p>
        <p>개인정보 침해 상담은 <a href="https://privacy.kisa.or.kr" target="_blank" rel="noreferrer">개인정보침해 신고센터</a>(국번 없이 118), <a href="https://www.kopico.go.kr" target="_blank" rel="noreferrer">개인정보분쟁조정위원회</a>(1833-6972) 등에서 받을 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="8. 아동·청소년 보호">
        <p>만 14세 미만 아동의 계정·개인위치정보를 법정대리인 동의 없이 처리하지 않습니다. 정식 출시 전 연령 확인과 법정대리인 동의 또는 14세 미만 회원 기능 제한 절차를 적용합니다. 공개 프로그램 검색은 로그인 없이 이용할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="9. 방침 변경">
        <p>법령, 서비스, 수탁업체가 바뀌면 시행일과 변경 이유를 최소 7일 전에 알리고, 이용자 권리에 중요한 변경은 원칙적으로 30일 전에 고지합니다. 이전 방침도 확인할 수 있도록 보관합니다.</p>
        <Callout>위치 처리의 더 자세한 흐름과 보유기간은 <a href="/location-terms">위치기반서비스 이용약관</a>에서 확인할 수 있습니다. 개인정보 처리방침의 법적 기준은 <a href="https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1033214957" target="_blank" rel="noreferrer">개인정보 보호법 제30조</a>에서 확인할 수 있습니다.</Callout>
      </LegalSection>
    </LegalPage>
  );
}
