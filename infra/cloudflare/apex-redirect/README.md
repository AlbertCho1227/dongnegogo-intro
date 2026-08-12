# 동네고고 apex 리디렉션

`http://dongnegogo.com`과 `https://dongnegogo.com` 요청을 정식 주소인
`https://www.dongnegogo.com`으로 이동시킵니다. 경로와 쿼리 문자열은 그대로
보존합니다.

이 Worker는 `www.dongnegogo.com`을 처리하지 않습니다. 소개 홈페이지의 배포와
독립되어 있으므로, 사이트를 업데이트해도 세 주소의 콘텐츠가 자동으로 동일하게
유지됩니다.
