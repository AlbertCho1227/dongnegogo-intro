# 동네고고 Web

`www.dongnegogo.com`에서 제공하는 동네고고 서비스 소개용 반응형 홈페이지입니다.

## 구성

- 동네고고 서비스와 주요 기능 소개
- 실제 iOS 앱 화면을 활용한 기능 미리보기
- 모바일, 태블릿, 데스크톱 반응형 레이아웃
- 서울 리전의 공개 통계 RPC를 서버에서만 하루 한 번 조회하는 소개 페이지

이 웹사이트는 카카오 지도 SDK, 브라우저 위치 권한, Supabase 브라우저 클라이언트를 사용하지 않습니다. 프로그램 통계는 서버에서 검증한 공개 RPC 결과만 표시하며, 실제 프로그램 탐색과 신청 기능은 동네고고 앱에서 제공합니다.

## 로컬 실행

Node.js 22.13 이상에서 다음 명령을 실행합니다.

```bash
npm install
npm run dev
```

검증은 `npm test`로 실행합니다.

## 서버 환경 변수

`.env.example`을 참고해 아래 두 값을 서버 환경에만 설정합니다.

- `DONGNEGOGO_SUPABASE_URL`: 서울 리전 Supabase 프로젝트 URL
- `DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY`: 공개 통계 RPC 호출용 publishable key

두 변수 모두 `NEXT_PUBLIC_` 또는 `VITE_` 접두사를 사용하지 않습니다.
