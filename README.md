# TabScore

브라우저에서 기타·베이스 TAB과 오선보를 작성하고 재생하는 악보 편집기입니다. React, TypeScript, Zustand, Vite를 사용합니다.

## 실행 및 검증

Node.js 24와 `package.json`의 `packageManager`에 지정된 pnpm 버전을 사용합니다.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| `src/model` | 악보 데이터와 파생 계산 |
| `src/engine` | 편집·레이아웃·기보·재생·검증 |
| `src/store` | 악보·화면·재생 상태 |
| `src/io` | 파일 읽기·쓰기 |
| `src/app`, `src/ui` | 컨트롤러와 편집 화면 |
| `specs` | 기능 명세 |

## 알려진 한계와 작업 규칙

실제 Guitar Pro 바이너리 파일은 MusicXML로 변환해 가져와야 합니다. 데스크톱 악보 편집을 우선하고 있으며, 형식별 상호 운용성과 브라우저별 동작은 해당 단계에서 검증합니다. [점검 보고서](https://claude.ai/artifact/TU9yXYwJ7rcJtiaSJRRemS) · [리팩토링 설계서](docs/refactoring/refactoring-design.md)

버그 수정은 재현 테스트를 먼저 작성하고, 해당 테스트를 통과시킨 뒤 타입 검사·단위 테스트·배포 빌드·브라우저 테스트를 실행합니다. 큰 엔진 변경은 작은 단위로 나누고 파일 형식 변경에는 버전별 마이그레이션을 포함합니다.

현재 재생은 브라우저에서 합성합니다. 악보 기호는 Steinberg의 Bravura 1.482와 SMuFL 글리프 이름을 사용합니다. 글꼴은 SIL Open Font License 1.1로 배포됩니다. [Bravura 릴리스](https://github.com/steinbergmedia/bravura/releases/tag/bravura-1.482) · [라이선스](public/fonts/bravura/OFL.txt)
