# 공식 소셜 로그인 이미지

이 폴더의 이미지는 각 인증 제공자의 공식 개발자 사이트에서 내려받았습니다.

## 바로 사용하기

| 채널 | 로그인 버튼 | 아이콘 전용 |
| --- | --- | --- |
| 카카오 | `/auth/kakao/sign-in-ko.png` | `/auth/kakao/icon-ko.png` |
| Apple (검정) | `/auth/apple/sign-in-ko-black@2x.png` | `/auth/apple/logo-black@2x.png` |
| Apple (흰색) | `/auth/apple/sign-in-ko-white@2x.png` | `/auth/apple/logo-white@2x.png` |
| Google | `/auth/google/sign-in-light.svg` 또는 `/auth/google/sign-in-light@2x.png` | `/auth/google/icon-light.svg` 또는 `/auth/google/icon-light@2x.png` |

PNG의 `@2x` 파일은 CSS에서 표시 크기를 원본 픽셀 크기의 절반으로 지정합니다. SVG는 화면 크기에 맞춰 비율을 유지해서 사용합니다.

## 공식 출처

- 카카오 로그인 디자인 가이드: <https://developers.kakao.com/docs/ko/kakaologin/design-guide>
- 카카오 로그인 리소스: <https://developers.kakao.com/tool/resource/login>
- Sign in with Apple 디자인 리소스: <https://developer.apple.com/design/resources/>
- Apple 공식 버튼 생성 API: <https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms>
- Sign in with Google 브랜드 가이드 및 다운로드: <https://developers.google.com/identity/branding-guidelines>

각 파일은 제공자의 브랜드 가이드에 맞춰 비율, 색상, 여백을 변경하지 않고 사용해야 합니다. 원본 배포 묶음은 저장소 최상위의 `brand-assets-original` 폴더에 보관했습니다. Apple DMG는 약관 동의가 필요한 원본이므로 해제하지 않았고, 실제 PNG는 Apple 공식 버튼 생성 API에서 직접 받았습니다.
