import type { Metadata } from "next";
import { Callout, DataTable, Flow, LegalMeta, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "계정·데이터 삭제 | 동네고고",
  description: "동네고고 계정과 연결된 개인정보를 즉시 삭제하는 방법을 안내합니다.",
  alternates: { canonical: "/account-deletion" },
};

export default function AccountDeletionPage() {
  return (
    <LegalPage eyebrow="이용자 권리" title="계정·데이터 삭제" description="앱에서 본인 확인을 마치면 계정과 연결 데이터가 즉시 삭제되며 되돌릴 수 없습니다.">
      <LegalMeta>최종 수정·시행 2026년 8월 17일 · Apple 및 Google Play 앱 내 계정 삭제 기준과 개인정보 권리행사 창구에 함께 사용합니다.</LegalMeta>

      <LegalSection title="1. 앱에서 즉시 삭제">
        <Flow label="계정 삭제 처리 흐름" steps={[
          { title: "삭제 선택", body: "내정보의 계정 삭제에서 없어지는 항목과 대안을 확인합니다." },
          { title: "본인 확인", body: "현재 연결된 로그인 방법으로 다시 확인하고 ‘삭제합니다’를 입력합니다." },
          { title: "즉시 파기", body: "사진 저장소를 먼저 비운 뒤 운영 DB, 로그인 계정·세션과 기기 캐시를 삭제합니다." },
          { title: "완료", body: "삭제된 계정은 복구할 수 없고, 같은 계정으로 로그인된 다른 기기·앱도 서버 확인 시 자동 로그아웃됩니다." },
        ]} />
        <Callout>30일 복구·유예 기간은 운영하지 않습니다. 삭제 버튼을 최종 확인하면 처리 중 취소하거나 삭제된 찜·알림·후기·사진·가족 정보를 복원할 수 없습니다.</Callout>
        <p>앱을 이용할 수 없으면 아래 이메일로 요청할 수 있습니다. 운영자는 최소한의 방법으로 본인을 확인한 뒤 법령상 보존 의무가 없는 정보를 지체 없이 삭제합니다. 비밀번호, 주민등록번호, 신분증 전체 사본은 보내지 마세요.</p>
        <p><a className="legal-delete-button" href="mailto:forestieum@gmail.com?subject=%EB%8F%99%EB%84%A4%EA%B3%A0%EA%B3%A0%20%EA%B3%84%EC%A0%95%C2%B7%EB%8D%B0%EC%9D%B4%ED%84%B0%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD&body=%EB%A1%9C%EA%B7%B8%EC%9D%B8%20%EC%A0%9C%EA%B3%B5%EC%9E%90(Apple%2FGoogle%2FKakao%2FToss)%3A%0A%EC%82%AD%EC%A0%9C%20%EB%B2%94%EC%9C%84(%EA%B3%84%EC%A0%95%20%EC%A0%84%EC%B2%B4%2F%EC%84%A0%ED%83%9D%20%EB%8D%B0%EC%9D%B4%ED%84%B0)%3A%0A%EC%9A%94%EC%B2%AD%20%EB%82%B4%EC%9A%A9%3A">계정·데이터 삭제 이메일 보내기</a></p>
      </LegalSection>

      <LegalSection title="2. 즉시 삭제되는 정보">
        <DataTable headers={["구분", "처리"]} rows={[
          ["인증 계정", "Supabase 사용자, Apple·Google·Kakao·Toss 로그인 식별자, 인증 세션과 refresh token 삭제"],
          ["사용자 콘텐츠", "후기, 댓글, 후기 사진, 시설 사진 제보 및 관련 저장 파일 삭제"],
          ["개인 기능", "찜, 오픈런 알림, 가족 구성원, 리뷰 공개 ID와 약관 동의 기록 삭제"],
          ["기기 로컬 데이터", "최근 검색·열람, 계정 설정, 찜·알림·가족·후기 상태, 웹·이미지·지도 캐시와 임시 파일 삭제"],
          ["소셜 제공자", "동네고고 안의 연결 정보는 삭제하지만 Apple·Google·Kakao·Toss 자체 계정은 삭제하지 않음. 제공자 설정의 앱 연결은 별도로 해제 가능"],
        ]} />
        <p>선택한 탈퇴 이유는 계정과 연결해 저장하지 않고 일별 합계로만 최대 1년 보관합니다. 자유 입력 탈퇴 의견, 이메일, 계정 UUID, IP, 개별 삭제 시각은 이 통계에 남기지 않습니다.</p>
      </LegalSection>

      <LegalSection title="3. 즉시 삭제의 예외">
        <ul>
          <li><strong>법정 보관:</strong> 관계 법령이 특정 자료의 보관을 요구하면 이용 중 데이터와 분리하고 해당 기간이 끝나는 즉시 삭제합니다.</li>
          <li><strong>암호화 백업:</strong> 장애 복구용 백업에는 삭제 전 사본이 최대 7일 남을 수 있습니다. 일반 서비스·조회·분석에 사용하지 않고 접근을 제한하며 순환 교체 시 삭제합니다. 탈퇴자 식별자를 별도로 보관하지 않으므로 삭제 전 백업을 운영 서비스에 그대로 복원하지 않습니다. 불가피하게 복원할 때에는 모든 이용자 계정·인증·작성 콘텐츠를 제거한 뒤 공개 프로그램 데이터만 복구합니다.</li>
          <li><strong>보안·접속 로그:</strong> Supabase·Cloudflare 등 수탁사가 보안과 장애 대응을 위해 보유하는 필수 로그는 각 계약·법령상 기간 뒤 삭제되며, 동네고고가 광고나 행동분석에 재사용하지 않습니다.</li>
          <li><strong>계정과 분리된 위치 캐시:</strong> 계정 ID 없이 만든 경로 캐시는 특정 회원을 찾아 골라낼 수 없으며 2~6시간 뒤 자동 만료됩니다.</li>
          <li><strong>외부 기관 신청:</strong> 동네고고가 연결한 기관 사이트에서 이미 접수한 신청은 해당 기관이 보유하므로 기관에 직접 취소·삭제를 요청해야 합니다.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. 계정을 유지한 선택 삭제">
        <p>계정을 유지하면서 후기·댓글·사진·찜·알림·가족 정보만 삭제할 수 있습니다. 앱에서 직접 삭제하거나 이메일 제목에 “선택 데이터 삭제”를 적고 대상을 알려주세요.</p>
      </LegalSection>

      <LegalSection title="5. 다른 기기·앱의 로그인 종료">
        <p>같은 동네고고 사용자 UUID로 연결된 iOS·Android·앱인토스의 인증 세션과 refresh token은 계정 삭제 시 서버에서 함께 삭제됩니다. Google·Kakao·Toss 로그인과 iOS의 Apple 로그인 중 어떤 방법을 사용했는지와 관계없이 동일한 동네고고 계정에 공통으로 적용됩니다.</p>
        <p>실행 중인 앱은 서버의 계정 상태를 주기적으로 확인하고, 앱이 다시 활성화되거나 네트워크가 복구될 때에도 확인합니다. 계정 삭제 또는 서버 세션 종료가 확인되면 자동으로 로그아웃하고, 계정이 다른 기기에서 삭제되었다는 안내를 표시한 뒤 해당 기기의 계정 관련 로컬 저장값과 캐시를 정리합니다.</p>
        <Callout>완전히 종료되었거나 백그라운드에 있거나 오프라인인 기기는 삭제 알림을 즉시 받을 수 없습니다. 해당 기기에서 앱을 다시 열거나 네트워크가 연결되는 즉시 서버 상태를 확인해 로그아웃합니다.</Callout>
      </LegalSection>

      <LegalSection title="6. 소셜 연결과 남은 로그인 토큰">
        <p>소셜 제공자 설정에서 동네고고 연결만 끊으면 로그인은 중지되지만 동네고고 DB의 후기·찜 등이 자동 삭제되는 것은 아닙니다. 앱의 계정 삭제 또는 위 이메일 요청을 함께 이용해야 합니다.</p>
        <p>JWT 특성상 삭제 전에 발급된 access token 문자열이 다른 기기에 만료 시각까지 남아 있을 수 있으나, 앱은 로컬 토큰만으로 계정 존속을 판단하지 않고 Auth 서버의 사용자를 확인합니다. 서버 사용자·세션·연결 데이터가 삭제된 뒤에는 계정 기능에 접근할 수 없으며, 확인한 앱은 로컬 토큰도 삭제합니다.</p>
        <p>관련 기준은 <a href="https://developer.apple.com/support/offering-account-deletion-in-your-app/" target="_blank" rel="noreferrer">Apple 앱 내 계정 삭제 안내</a>, <a href="https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#unlink" target="_blank" rel="noreferrer">Kakao 연결 끊기 안내</a>, <a href="https://support.google.com/googleplay/android-developer/answer/13327111?hl=ko" target="_blank" rel="noreferrer">Google Play 계정 삭제 요건</a>에서 확인할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="7. 문의와 권리 행사">
        <p>개인정보 보호책임자 정재은 · 대표번호 <a href="tel:07080987879">070-8098-7879</a> · <a href="mailto:forestieum@gmail.com">forestieum@gmail.com</a></p>
        <Callout>파기 원칙과 예외 보관은 <a href="/privacy">개인정보처리방침</a>에 동일하게 반영합니다. 계정 삭제는 외부 기관의 프로그램 신청 취소를 대신하지 않습니다.</Callout>
      </LegalSection>
    </LegalPage>
  );
}
