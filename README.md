# 동네고고 Web

동네고고 iOS 앱과 같은 Supabase 프로젝트를 사용하는 지도 중심 웹 서비스입니다.

## 로컬 실행

1. `.env.example`을 참고해 `.env.local`을 설정합니다.
2. Node.js 22.13 이상에서 `npm install`을 실행합니다.
3. `npm run dev`로 개발 서버를 시작합니다.

## 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 브라우저용 publishable key
- `NEXT_PUBLIC_KAKAO_MAP_JS_KEY`: Kakao Developers의 JavaScript 키

Supabase의 service role 키나 Kakao Admin 키는 브라우저 환경에 넣지 않습니다.
