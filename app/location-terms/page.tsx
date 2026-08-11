import type { Metadata } from "next";
import { Callout, DataTable, Flow, LegalMeta, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "위치기반서비스 이용약관 | 동네고고",
  description: "동네고고 위치기반서비스의 내용, 위치정보 흐름, 보유기간과 이용자 권리를 안내합니다.",
  alternates: { canonical: "/location-terms" },
};

export default function LocationTermsPage() {
  return (
    <LegalPage eyebrow="위치정보 보호" title="위치기반서비스 이용약관" description="현재 위치를 언제, 어디로 보내고, 얼마나 보관하는지 실제 서비스 흐름을 기준으로 설명합니다.">
      <LegalMeta>공개일 2026년 8월 11일 · 「위치정보의 보호 및 이용 등에 관한 법률」 기준 준비본 · 정식 시행일은 출시 전에 고지합니다.</LegalMeta>

      <LegalSection title="1. 사업자 정보와 적용 범위">
        <p>본 약관은 동네고고 앱과 앱인토스에서 제공하는 주변 탐색·거리·길찾기 기능에 적용됩니다. 현재는 정식 출시 전 테스트 단계이며 운영자의 법적 상호, 주소, 전화번호, 위치정보관리책임자는 정식 서비스 개시 전에 확정·게시합니다. 문의는 <a href="mailto:forestieum@gmail.com">forestieum@gmail.com</a>으로 접수합니다.</p>
        <Callout>정식 출시 전 위치기반서비스사업 신고 대상과 시점을 확인하여 필요한 신고를 완료하고, 앱에서 이 약관에 대한 별도 동의 화면을 제공합니다.</Callout>
      </LegalSection>

      <LegalSection title="2. 위치정보가 흐르는 과정">
        <Flow label="사용자 위치 기반 데이터 흐름" steps={[
          { title: "권한과 동의", body: "이용자가 위치약관과 iOS·Android·Toss 위치 권한을 승인합니다." },
          { title: "단말 처리", body: "현재 좌표로 지도 중심, 거리, 가까운 프로그램과 쉼터를 계산합니다." },
          { title: "서버·외부 API", body: "선택한 지도 범위는 Supabase에, 길찾기 좌표는 동네고고 서버를 거쳐 Kakao 등에 전달됩니다." },
          { title: "단기 보관·삭제", body: "경로 응답은 계정과 분리해 2~6시간 캐시하고 만료 후 15분 주기로 삭제합니다." },
        ]} />
      </LegalSection>

      <LegalSection title="3. 제공하는 위치기반서비스">
        <DataTable headers={["기능", "이용하는 위치정보", "처리 방식"]} rows={[
          ["주변 프로그램·무더위쉼터", "현재 위치 또는 이용자가 이동한 지도 범위", "가까운 공공 프로그램·시설과 거리를 정렬해 표시"],
          ["지도 중심·지역명", "현재 좌표 또는 지도 중심", "단말 및 지도 SDK에서 화면 이동과 행정지역 안내에 사용"],
          ["도보·자동차·대중교통 길찾기", "현재 위치와 목적지 좌표", "Kakao 지도·경로 API와 공공 교통정보를 이용해 경로·시간을 계산"],
          ["가까운 역·정류장", "현재 위치·시설 좌표", "주변 역·정류장과 도보 거리를 계산"],
        ]} />
        <p>모든 위치 기능은 무료입니다. 통신사 데이터 요금과 외부 지도 앱 사용에 따른 비용은 이용자의 이용환경에 따라 발생할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="4. 보유 목적과 기간">
        <ul>
          <li><strong>단말 현재 위치:</strong> 화면 표시와 거리 계산 중 메모리에서 처리하며 동네고고 계정 프로필로 영구 저장하지 않습니다.</li>
          <li><strong>지도 조회 범위:</strong> 프로그램 검색 요청에 사용되며 별도의 사용자 위치 이력으로 저장하지 않습니다.</li>
          <li><strong>사용자 경로 캐시:</strong> 원점과 목적지, 계산 경로가 포함될 수 있습니다. 계정 ID 없이 원점을 약 100m 단위로 반올림한 일방향 해시 키로 2~6시간 보관하고 만료분을 15분마다 삭제합니다.</li>
          <li><strong>시설 주변 정류장:</strong> 사용자 위치가 아닌 시설 좌표 기반 공통 정보이며 최대 14일 캐시합니다.</li>
          <li><strong>법정 확인자료:</strong> 정식 서비스 개시 후 위치정보의 수집·이용·제공 주체, 취득경로, 일시와 방법 등 확인자료(좌표 자체는 제외)를 자동 기록하고 원칙적으로 6개월 보관합니다. 법령상 보존 대상이 아닌 원좌표·경로 캐시와 분리합니다.</li>
        </ul>
        <Callout>현재 테스트 환경의 단기 경로 캐시는 위 법정 확인자료를 대신하지 않습니다. 정식 출시 전 별도 확인자료 기록·열람·파기 절차를 구현하고 검증합니다.</Callout>
      </LegalSection>

      <LegalSection title="5. 외부 제공·처리">
        <DataTable headers={["받는 곳", "목적", "항목", "보유"]} rows={[
          ["Kakao Corp.", "장소·역 검색, 도보·자동차·대중교통 경로 계산", "출발·도착 좌표, 검색 반경", "Kakao의 API 운영정책에 따름. 동네고고 계정 ID는 전송하지 않음"],
          ["Apple 지도·Core Location", "iOS 위치 측정, 일부 자동차 경로·역지오코딩", "기기 위치, 출발·도착 좌표", "Apple의 기기·지도 정책에 따름"],
          ["Supabase, Inc.", "지도 범위 조회와 단기 경로 캐시", "지도 범위, 목적지, 경로 응답", "서울 리전. 사용자 경로 캐시 2~6시간"],
          ["공공 교통정보 API", "버스·지하철·열차 정보", "정류장·역·노선·일자 검색값", "계정 ID를 제공하지 않음"],
        ]} />
      </LegalSection>

      <LegalSection title="6. 이용자의 권리와 거부 방법">
        <p>이용자는 언제든 위치정보 이용 동의의 전부 또는 일부를 철회하고 일시 중지를 요구하며 이용·제공 사실의 열람·정정·삭제를 요청할 수 있습니다. 기기 설정에서 동네고고 위치 권한을 끄면 즉시 현재 위치 이용이 중지됩니다. 위치를 허용하지 않아도 기본 지역 또는 직접 이동한 지도 범위로 공개 프로그램을 볼 수 있습니다.</p>
        <p>철회·삭제 요청은 <a href="mailto:forestieum@gmail.com?subject=%EB%8F%99%EB%84%A4%EA%B3%A0%EA%B3%A0%20%EC%9C%84%EC%B9%98%EC%A0%95%EB%B3%B4%20%EC%B2%98%EB%A6%AC%20%EC%9A%94%EC%B2%AD">이메일</a>로 접수하며, 본인 확인 후 법령상 보존 의무가 없는 개인위치정보와 이용·제공 확인자료를 지체 없이 삭제합니다.</p>
      </LegalSection>

      <LegalSection title="7. 14세 미만 아동과 법정대리인">
        <p>14세 미만 아동의 개인위치정보는 법정대리인의 동의 없이 이용·제공하지 않습니다. 정식 출시 전 법정대리인 동의 절차를 제공하거나 14세 미만 계정의 위치 기능을 제한합니다. 법정대리인은 아동을 대신해 열람·정정·철회·삭제 권리를 행사할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="8. 약관 변경과 분쟁">
        <p>중요한 변경은 적용일과 사유를 원칙적으로 30일 전에 알립니다. 이 약관에 정하지 않은 사항은 위치정보법, 개인정보 보호법 및 관계 법령에 따릅니다.</p>
        <p>관련 법령은 <a href="https://www.law.go.kr/LSW/lsInfoP.do?lsId=009882" target="_blank" rel="noreferrer">국가법령정보센터 위치정보법</a>에서 확인할 수 있습니다.</p>
      </LegalSection>
    </LegalPage>
  );
}
