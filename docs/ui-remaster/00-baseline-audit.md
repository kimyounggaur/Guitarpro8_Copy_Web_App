# Phase 0 — 리마스터 전 기준선 감사

작성일: 2026-07-11
대상 커밋: `48df63e` (chore: initial commit before GP8 UI/UX remaster)
감사 범위: 코드 변경 없음. 문서·측정값만 수집.

## 1. 기술 스택 확인

`package.json` 기준:

- React 18.3.1 + TypeScript 5.7.3 + Vite 6.4.3(설치 시 lockfile은 `^6.0.5`)
- 상태관리: Zustand 4.5.5 + Immer 10.1.1
- 테스트: Vitest 2.1.9 (Playwright는 아직 미설치 — Phase 1 대상)
- 패키지 매니저: `pnpm-lock.yaml` 존재 (pnpm 기준 워크플로)

## 2. 로컬 환경 이슈 (코드 결함 아님, 인프라 결함)

이 저장소는 최초 상태에서 git 저장소가 아니었다. 감사 시작 전 `git init` 후 현재 상태를 `chore: initial commit before GP8 UI/UX remaster`로 커밋했다.

### 2.1 `pnpm install`이 이 로컬 환경(Node v25.2.1, Windows)에서 실패함

- 증상: `pnpm install` 실행 시 tarball 압축 해제 단계에서 안정적으로 `EXIT=127` 또는 `STATUS_STACK_BUFFER_OVERRUN`(0xC0000409)류 네이티브 크래시로 중단된다.
- 격리 근거: 동일 `package.json`을 `npm install`로 설치하면 정상 완료된다. `pnpm test`/`pnpm build`처럼 pnpm이 단순히 `package.json`의 script를 실행할 때는 문제없이 동작한다 — 오직 pnpm의 자체 fetch/extract 파이프라인만 이 환경에서 깨진다.
- 이 감사에서는 `npm install`로 `node_modules`를 채운 뒤 `pnpm test` / `pnpm build`(둘 다 내부적으로 로컬 바이너리를 호출하는 npm-script proxy)를 사용해 진행했다.
- 후속 Phase에서 의존성을 추가할 때도 `npm install <pkg> --save-dev` 등으로 설치하고 `pnpm-lock.yaml`은 가능한 범위에서 수동으로 정합성을 맞춘다. pnpm 자체가 이 머신에서 install을 수행하지 못하는 것은 프로젝트 소스와 무관한 로컬 툴체인 문제로 별도 기록한다.

### 2.2 기본 `pnpm build`(`vite build`)가 minify 단계에서 크래시함

- 증상: `tsc --noEmit && vite build` 실행 시 "94 modules transformed" 이후 렌더링 단계에서 `exit code 3221226505`(=0xC0000409, STATUS_STACK_BUFFER_OVERRUN)로 프로세스가 죽는다.
- 격리 과정:
  1. `vite build --minify false` → 정상 완료 (`dist/` 정상 생성, gzip 크기까지 출력).
  2. `node_modules/.bin/rollup entry.js --file out.js --format es` (단독 CLI) → 정상.
  3. `node_modules/.bin/esbuild.cmd --version` → 정상.
  4. `node_modules/.bin/esbuild.cmd dist/assets/index-*.js --minify --outfile=...` (단독 CLI로 동일 번들 minify) → 정상.
  5. 즉 minify 대상 코드도, esbuild/rollup CLI 자체도 문제가 없다. 오직 Vite가 esbuild의 in-process JS API(minify service)를 통해 번들을 minify하는 경로에서만 크래시가 재현된다. 이는 Node v25.2.1(매우 최신 버전)과 esbuild의 IPC 계층 간 호환성 문제로 판단된다.
  6. 부수적으로 `node_modules/@rollup/rollup-win32-x64-gnu`가 설치되어 있었으나 `require()` 시 `ERR_DLOPEN_FAILED`(의존 DLL 누락, MinGW 런타임 부재로 추정)를 던지는 깨진 optional native binding이었다. 이 폴더를 제거했지만 crash 자체는 해결되지 않았다 — 즉 이 문제는 원인이 아니라 별개의 잠재적 이슈였다.
- 이 문제는 후속 Phase의 `pnpm build: PASS` 게이트를 매번 막으므로, Phase 0 종료 직후 별도의 단일 커밋(`fix(build): ...`)으로 minifier를 esbuild 대신 terser로 전환해 인프라를 정상화할 예정이다. Phase 0 자체는 read-only 원칙에 따라 이 수정을 포함하지 않는다.

## 3. `pnpm install` / `pnpm test` / `pnpm build` 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `pnpm install` | **FAIL (환경 이슈)** | 위 2.1 참고. `npm install`로 대체 수행, 정상 완료 |
| `pnpm test` | **PASS** | `vitest run`, 15 test files / 80 tests 전부 통과, 1.39s |
| `pnpm build` | **FAIL → 조건부 PASS** | `tsc --noEmit` 통과, `vite build` 기본 옵션은 위 2.2 크래시. `vite build --minify false`로는 정상 산출물 생성 확인 |

## 4. 실제 레이아웃 치수 (DOM 측정, `getBoundingClientRect` 기준)

이 환경의 Browser 도구는 실제 픽셀 스크린샷 캡처(`screenshot`/`zoom`)가 타임아웃되어 사용할 수 없었다(다른 모든 액션 — 클릭, 키 입력, JS 실행, 콘솔/네트워크 조회, `read_page` 접근성 트리 — 는 정상 동작). 따라서 스크린샷 대신 4개 뷰포트 각각에서 `getBoundingClientRect()` / `getComputedStyle()`를 이용한 정밀 DOM 측정으로 앵커 값을 수집했다. 이 방식은 픽셀 눈대중보다 오차가 없다는 장점이 있으나, 문서가 요구하는 `.png` 파일 자체는 이번 Phase에서 생성하지 못했다 — 아래 "완료 조건 대비 남은 차이"에 기록.

공통 구조 (모든 뷰포트 동일):
- `.menuBar` height: **32px**
- `.toolbar` height: **54px** (y=32)
- `.tabBar` height: **38px** (y=86)
- 본문 영역(`.gpMain`) 시작 y: **124px**
- `.palettePanel` width: **214px** (고정, 리사이즈 불가 — 4절 참고)
- `.inspectorPanel` width: **286px** (고정)
- `.bottomDock`(Global View) height: **230px** (1024/1280 기준), 1440 기준 270px, 1920 기준 324px — 즉 창 높이에 비례해 늘어나는 유동 높이이며 GP8 목표처럼 사용자가 드래그로 조절/영속화하는 구조가 아니다.

뷰포트별 측정:

| 항목 | 1024×768 | 1280×768 | 1440×900 | 1920×1080 |
|---|---:|---:|---:|---:|
| menuBar/toolbar/tabBar 폭 | 1024 | 1265* | 1425* | 1905* |
| palettePanel | 0,124 / 214×414 | 0,124 / 214×414 | 0,124 / 214×506 | 0,124 / 214×632 |
| workspacePanel | 214,124 / 524×414 | 214,124 / 765×414 | 214,124 / 925×506 | 214,124 / 1405×632 |
| inspectorPanel x | 738 | 979 | 1139 | 1619 |
| bottomDock height | 230 | 230 | 270 | 324 |
| `document.documentElement.scrollWidth` | **2310** | **2327** | **2327** | **2327** |
| LCD(`.lcd`) x 위치 | 1614 (뷰포트 밖) | 1631 (뷰포트 밖) | 1631 (뷰포트 밖) | 1631 (뷰포트 밖) |

\* 세로 스크롤바 너비(약 15px)만큼 뷰포트보다 작게 측정됨.

### 4.1 툴바 오버플로 — 중대 결함

`document.documentElement.scrollWidth`가 모든 뷰포트에서 **2310~2327px**로 고정되어 있다. 이는 툴바(및 그 하위 그룹)가 반응형으로 줄어들거나 넘치는 항목을 overflow 메뉴로 옮기는 로직이 전혀 없고, 콘텐츠가 요구하는 실제 폭(~2327px)만큼 페이지 자체가 가로로 넘친다는 뜻이다. 1920px 뷰포트에서도 `.lcd`가 x=1631에서 시작해 `right` 방향 콘텐츠(재생 컨트롤 등)가 실제로는 화면 밖(1920 초과)까지 이어진다.

1024×768 기준으로 13개 `.toolbarGroup` 중 **10개**가 뷰포트 밖이거나 `width:0/height:0`으로 측정되었다:
`liveZoomGroup, liveDisplayGroup, zoomGroup, displayGroup, historyGroup, printGroup, transportGroup, transportGroup.transportLegacy, playbackTools, utilityGroup.utilityLegacy`

이 중 `zoomGroup`, `displayGroup`, `printGroup`, `transportGroup.transportLegacy`, `utilityGroup.utilityLegacy` 다섯 그룹은 **모든** 뷰포트(1920px 포함)에서 `rect = {x:0,y:0,w:0,h:0}`로 측정되어, 화면 크기와 무관하게 항상 크기가 0이다 — 즉 반응형 실패가 아니라 CSS로 완전히 숨겨진 죽은/중복 블록이다. `App.css`에서 `transportLegacy`, `utilityLegacy`라는 클래스명 자체가 존재해 "레거시로 남아있으나 정리되지 않은 중복 툴바 그룹"이라는 리마스터 문서의 진단(섹션 2.2, Phase 3)과 정확히 일치한다.

## 5. 색상 / 간격 / 라운드 / 글꼴 요약 (`src/App.css`, 1386줄)

- 현재 팔레트는 짙은 녹색/올리브 계열이다. 대표 배경/보더/텍스트 색상 샘플: `#20211d`, `#151814`, `#171c1a`(배경류), `#383b34`, `#43483f`, `#3d453c`(보더류), `#6fb99f`, `#84d1b6`, `#9fd9c6`(민트/그린 강조), `#f7c75f`(골드 강조 — 커서/선택), `#5ca6ff`/`#7fbdf4`(파랑, 일부 링크·포커스에 한정적으로 사용). GP8 목표 토큰(§3.4)의 네이비/슬레이트/블루 계열과는 색상 계통 자체가 다르다.
- `border-radius`는 코드베이스 전반에서 **4~8px**가 지배적이다(6px 9회, 8px 4회, 5px 4회, 4px 3회, 2~3px 소수). 목표 문서가 지적한 "카드형 6–8px" 인상과 일치한다.
- 폰트: 별도 웹폰트 로드 없이 OS 기본 sans-serif 사용 중으로 보임(추가 검증 필요 — Phase 3에서 재확인).

## 6. 기능 진입점 → command id 매핑 여부

- `.commandPalette`를 `Ctrl+E`로 열면 `Flow`, `x:` (Go to bar), `@` (Show and trigger actions), `$` (Go to section), `4/4` (Set time signature), `add-bar` 등 다중 모드 파서가 실제로 동작한다 — Command Palette 자체의 명령 실행 경로는 **동작함**.
- 반면 최상단 메뉴바(File/Edit/Track/.../Help 12개)는 버튼 클릭 시 DOM에 어떤 드롭다운/메뉴 요소도 생성되지 않는다(§7.1 참고) — 메뉴는 command registry와 전혀 연결되어 있지 않고 이름만 있는 버튼이다.
- 툴바 아이콘 버튼들(Palette/Song/Track/Global/Automation 토글, Add Track, Tuning, Voices, Drum kit, Command Palette, Stylesheet, Chord/Scale/Instrument/Tuner/Transpose/Check bar duration)은 모두 `title` 속성에 사람이 읽을 수 있는 이름 + 단축키가 붙어 있고 클릭 시 실제 동작한다.

## 7. 비작동 메뉴/탭 상세 (증거)

### 7.1 메뉴바 — 완전 비작동 (placeholder)

`ref`로 "File" 버튼을 클릭한 직후 DOM을 조회한 결과, `role="menu"` 요소는 물론 `ul`/`.dropdown`/`.submenu`/`[class*="menu"]` 어떤 것도 새로 나타나지 않았다(기존 `.menuBar` 자체만 매치). File/Edit/Track/Bar/Note/Effects/Section/Tools/Sound/View/Window/Help **12개 메뉴 전부 동일하게 클릭에 반응하지 않는다** — Phase 6 대상.

### 7.2 문서 탭 "+" 버튼 — 완전 비작동

`.tabBar` 안에는 `activeTab`(1개, "Phase 9 Tools Demo")과 `tabAdd`("+") 버튼만 존재하며, 탭 닫기 버튼은 DOM에 전혀 없다. `tabAdd` 버튼을 클릭해도 `.tabBar` 내부 버튼 목록에 변화가 없다(새 탭이 생기지 않음) — Phase 8 대상.

### 7.3 패널 리사이즈 — 완전 부재

`[class*="splitter"], [class*="resize"], [role="separator"]` 셀렉터로 전체 문서를 조회한 결과 **0개**. 좌/우/하단 패널 크기를 드래그로 조절할 수 있는 UI가 현재 전혀 존재하지 않는다(순수 CSS 고정폭) — Phase 5 대상.

## 8. 고정 absolute 좌표를 사용하는 overlay 목록 (증거: `App.css` grep + 런타임 `getComputedStyle`)

| 선택자 | position | top | left | right |
|---|---|---|---|---|
| `.commandPalette` | absolute | 124px | 226px | 300px |
| `.stylesheetPanel`, `.fileIoPanel` | absolute | 92px | 226px | 300px |
| `.trackSystemPanel`(런타임 측정, Tuning 도구창) | absolute | 92px | 248px | 324px |

세 값 모두 좌/우 패널의 현재 고정폭(214px/286px)에 종속된 하드코딩 값으로, 리마스터 문서 15장이 명시적으로 금지하는 "`left: 220px; right: 280px`처럼 다시 하드코딩"과 사실상 동일한 패턴이다. `.trackSystemPanel`은 CSS가 아니라 런타임 클릭(Tuning 버튼 → 도구창 열기)으로 실측했다. Phase 15/16에서 overlay를 앵커 기반 계산으로 교체해야 한다.

## 9. UI 리팩터링에서 보호해야 할 음악 엔진 경계

리마스터 문서 §2.3과 동일하게 다음 디렉터리는 이번 리마스터 전 기간 동안 재작성 대상에서 제외한다: `src/model/**`, `src/engine/editing/**`, `src/engine/layout/**`, `src/engine/audio/**`, `src/engine/unroll/**`, `src/io/**`. Vitest 80개 테스트 중 다수가 이 경로들을 직접 커버하므로(`operations.test.ts`, `layout.test.ts`, `mixer.test.ts`, `unrollScore.test.ts`, `fileIo.test.ts` 등) 매 Phase 종료 시 `pnpm test` 전체 통과가 이 경계 위반 여부의 1차 신호가 된다.

## 10. 다음 Phase에서 먼저 고쳐야 할 순서와 이유

1. **인프라: build 크래시 수정** (Phase 0 이후, Phase 1 이전 별도 커밋) — 이후 모든 Phase의 `pnpm build: PASS` 게이트가 이 수정 없이는 항상 거짓 FAIL을 낸다.
2. **Phase 1 (Playwright)** — 스크린샷 기반 시각 회귀를 이 세션의 Browser 도구로는 수행할 수 없었으므로, Playwright의 번들 Chromium이 실제 픽셀 캡처를 제공하는지 가장 먼저 검증해야 한다(이 로컬 환경의 제약이 Playwright에도 적용되는지 별도 확인 필요).
3. **Phase 2 (App.tsx 분리)** — `src/App.tsx`가 2543줄, `EditorShell.tsx`가 1173줄로 두 파일에 편집·재생·파일·패널·명령 라우팅이 뒤섞여 있다(실측 `wc -l`). 이후 모든 UI Phase가 이 파일들을 반복해서 건드리므로 구조 분리를 가장 먼저 끝내야 회귀 위험이 줄어든다.
4. 이후 문서의 Phase 3~19 순서를 그대로 따른다 — 특히 Phase 5(패널 리사이즈 완전 부재)와 Phase 6(메뉴 완전 비작동), Phase 7(툴바 오버플로 심각)이 사용자 체감상 가장 시급하다.

## 11. 완료 조건 대비 남은 차이

- [x] 실제 검사 항목에 실제 결과 기록 (§4~9)
- [x] `pnpm test` / `pnpm build` 결과 기록 (§3)
- [x] git diff에 문서/설정(`.claude/launch.json`, `.gitignore`류) 외 제품 코드 변경 없음 — 확인: 이번 Phase 커밋에는 `docs/`, `.claude/launch.json`만 포함되고 `src/**`는 변경하지 않았다.
- [ ] **4개 뷰포트 `.png` 스크린샷** — 이 세션의 Browser 도구가 `screenshot`/`zoom` 액션에서 지속적으로 타임아웃되어(다른 모든 조작은 정상) 실제 이미지 파일을 생성하지 못했다. 대신 §4의 DOM 측정치로 대체했다. Playwright 도입(Phase 1) 후 Playwright의 자체 스크린샷 캡처로 이 갭을 메운다.

## 12. 상세 참조 문서

- 인터랙션별 working/partial/placeholder/broken 분류: [00-interaction-matrix.md](00-interaction-matrix.md)
- App.tsx/EditorShell.tsx 책임 분리 표 및 회귀 위험 목록: [00-component-map.md](00-component-map.md)
