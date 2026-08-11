import type { Metadata } from "next";
import { Callout, DataTable, Flow, LegalMeta, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "계정·데이터 삭제 | 동네고고",
  description: "동네고고 계정과 연결된 개인정보 삭제를 요청하는 방법을 안내합니다.",
  alternates: { canonical: "/account-deletion" },
};

export default function AccountDeletionPage() {
  return (
    <LegalPage eyebrow="이용자 권리" title="계정·데이터 삭제" description="로그인 계정과 연결 데이터를 삭제하거나, 계정을 유지한 채 특정 데이터만 삭제할 수 있습니다.">
      <LegalMeta>공개일 2026년 8월 11일 · Google Play 계정 삭제 웹 링크와 개인정보 권리행사 접수 창구로 사용할 수 있습니다.</LegalMeta>

      <LegalSection title="1. 삭제 요청 방법">
        <Flow label="계정 삭제 처리 흐름" steps={[
          { title: "요청", body: "앱의 내 정보에서 계정 삭제를 선택하거나 아래 전용 이메일로 요청합니다." },
          { title: "본인 확인", body: "로그인 세션 또는 가입 이메일·로그인 제공자로 계정 소유자를 확인합니다." },
          { title: "범위 확인", body: "계정 전체 또는 후기·사진 등 선택 데이터의 삭제 범위를 안내합니다." },
          { title: "삭제·완료", body: "확인 완료일부터 원칙적으로 7일 이내 삭제하고 결과를 알립니다." },
        ]} />
        <p><a className="legal-delete-button" href="mailto:forestieum@gmail.com?subject=%EB%8F%99%EB%84%A4%EA%B3%A0%EA%B3%A0%20%EA%B3%84%EC%A0%95%C2%B7%EB%8D%B0%EC%9D%B4%ED%84%B0%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD&body=%EB%A1%9C%EA%B7%B8%EC%9D%B8%20%EC%A0%9C%EA%B3%B5%EC%9E%90(Apple%2FGoogle%2FKakao)%3A%0A%EC%82%AD%EC%A0%9C%20%EB%B2%94%EC%9C%84(%EA%B3%84%EC%A0%95%20%EC%A0%84%EC%B2%B4%2F%EC%84%A0%ED%83%9D%20%EB%8D%B0%EC%9D%B4%ED%84%B0)%3A%0A%EC%9A%94%EC%B2%AD%20%EB%82%B4%EC%9A%A9%3A">계정·데이터 삭제 이메일 보내기</a></p>
        <p>비밀번호, 주민등록번호, 신분증 전체 사본은 이메일에 보내지 마세요. 필요한 경우 최소한의 추가 확인 방법을 별도로 안내합니다.</p>
      </LegalSection>

      <LegalSection title="2. 삭제되는 데이터">
        <DataTable headers={["구분", "처리"]} rows={[
          ["인증 계정", "Supabase 사용자 계정, 활성 세션과 연결된 로그인 식별자 삭제"],
          ["사용자 콘텐츠", "후기, 댓글, 제출 사진과 저장 파일 삭제. 법령상 보존이 필요한 예외는 사유와 기간을 안내"],
          ["개인 기능", "찜, 오픈런 알림, 가족 구성원 정보 삭제"],
          ["소셜 연결", "가능한 범위에서 Apple 토큰 철회, Kakao 연결 해제 등 로그인 제공자 연결 종료"],
          ["기기 로컬 데이터", "앱 삭제 또는 앱 내 초기화로 최근 검색·열람·캐시·설정 삭제"],
          ["백업", "운영 백업의 교체 주기 동안 제한적으로 남을 수 있으며 복원 외 목적으로 사용하지 않고 교체 시 삭제"],
        ]} />
      </LegalSection>

      <LegalSection title="3. 계정 없이 데이터만 삭제">
        <p>계정을 유지하면서 후기·댓글·사진·찜·알림·가족 정보 중 일부만 삭제할 수 있습니다. 앱에서 직접 삭제하거나 이메일 제목에 “선택 데이터 삭제”를 적고 삭제 대상을 알려주세요.</p>
      </LegalSection>

      <LegalSection title="4. 소셜 로그인 제공자에서 직접 연결을 끊은 경우">
        <p>Kakao·Apple·Google 계정 설정에서 동네고고 연결을 먼저 끊으면 로그인 토큰은 사용할 수 없게 되지만, 동네고고 데이터베이스의 계정·게시물이 자동으로 모두 삭제되지는 않을 수 있습니다. 이 페이지에서도 계정 삭제를 요청해 주세요.</p>
        <Callout>iOS 앱의 내정보에는 계정 삭제 경로가 제공되며, 본인 확인 후 동네고고 계정·후기·댓글·사진·찜·알림·가족 정보를 삭제합니다. 기기에 유효한 Kakao 토큰이 있으면 Kakao 연결 해제도 시도합니다. Apple·Google 또는 기기에 토큰이 남지 않은 Kakao 연결은 각 제공자 계정 설정에서 별도로 해제할 수 있습니다.</Callout>
        <p>관련 기준은 <a href="https://developer.apple.com/support/offering-account-deletion-in-your-app/" target="_blank" rel="noreferrer">Apple 앱 내 계정 삭제 안내</a>, <a href="https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#unlink" target="_blank" rel="noreferrer">Kakao 연결 끊기 안내</a>, <a href="https://support.google.com/googleplay/android-developer/answer/13327111?hl=ko" target="_blank" rel="noreferrer">Google Play 계정 삭제 요건</a>에서 확인할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="5. 처리 제한과 문의">
        <p>분쟁 처리, 수사 협조 등 법령상 보존 의무가 있는 정보는 다른 정보와 분리하고 법정 기간이 끝나면 삭제합니다. 삭제 완료 후에는 복구할 수 없습니다. 포레스트 이음(Forest Ieum)의 개인정보 보호책임자 조재완에게 보내는 문의는 <a href="mailto:forestieum@gmail.com">forestieum@gmail.com</a>으로 접수합니다.</p>
      </LegalSection>
    </LegalPage>
  );
}
