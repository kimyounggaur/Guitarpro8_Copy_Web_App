# Phase 1 — Playwright 동작·시각 회귀 하네스

작성일: 2026-07-11
브랜치: `remaster/phase-01-visual-harness`

## 1. 구현 요약

- `@playwright/test`(1.61.1)를 devDependency로 설치하고 `npx playwright install chromium`으로 번들 브라우저를 받았다.
- `playwright.config.ts` 신설: `testDir: "./src/test"`, Vite dev server를 포트 `5174`(`--strictPort`)로 자동 기동/종료(`webServer`), 실패 시 `trace: retain-on-failure`.
- 프로젝트 5개:
  - `chromium` — `src/test/e2e/**`만 실행, 1280×768 기본 뷰포트.
  - `visual-1024x768` / `visual-1280x768` / `visual-1440x900` / `visual-1920x1080` — `src/test/visual/**`만 실행, 각각 지정된 뷰포트.
- `package.json` script 3개 추가: `test:e2e`(`--project=chromium`), `test:visual`(4개 visual 프로젝트), `test:visual:update`(동일 + `--update-snapshots`).
- `src/test/testMode.ts` — `?testMode=visual` 쿼리 파라미터를 감지하는 `isVisualTestMode()`와, 감지 시 `<html data-testmode="visual">`를 찍는 `applyVisualTestModeMarker()`. `src/main.tsx`에서 앱 렌더 직전에 1회 호출.
- `src/test/visual/screenshot.css` — `[data-testmode="visual"]` 스코프에서만 `animation-duration`/`transition-duration`/`caret-color`/`scroll-behavior`를 0으로 고정. 레이아웃은 건드리지 않는다(요구사항: "숨기거나 왜곡하지 않는다").
- `vitest.config.ts`에 `exclude: ["src/test/e2e/**", "src/test/visual/**"]` 추가 — Playwright 스펙을 Vitest가 오인식해 `test.beforeEach` 충돌로 실패하던 문제를 해결.
- `.gitignore`에 `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`, `reference-ui/`, `visual-overlays/` 추가.
- `EditorShell.tsx`/`CommandPalette.tsx`에 안정적인 `data-testid` 9개 추가(gp-shell, workspace-panel, palette-panel, inspector-panel, bottom-dock, tab-bar, tab-add, document-tab, transport-play-stop, command-palette-open, command-palette, command-palette-input) — 클래스명이나 표시 문자열이 아니라 이 속성들로만 e2e locator를 구성했다.

## 2. determinism 관련 실제 조사 결과

Phase 1 착수 전 App.tsx/documentStore/demoScore에서 `Date.now()`/`Math.random()`/`new Date()` 사용처를 전수 조사했다(`grep -r`). 셸 렌더링에 관여하는 코드에는 해당 패턴이 없었고, 발견된 3곳(`io/exportNames.ts`의 파일명 타임스탬프, `io/nativeScore.ts`의 저장 시각, `engine/audio/sampler.ts`의 노이즈 합성)은 모두 이번 e2e/visual 스펙이 건드리는 흐름(패널 토글, 재생 시작/정지, Command Palette) 밖에 있다. 기본 demo score 자체도 결정론적이다(고정 ID, 랜덤 요소 없음). 따라서 `testMode`가 score를 다시 만들거나 시간을 고정할 필요가 없었다 — `data-testmode` 마킹 + CSS 애니메이션 제거만으로 충분했다. 이 판단이 후속 Phase에서 틀린 것으로 드러나면(예: LCD가 실시간 경과 시간을 표시하게 되는 Phase 7 이후) `testMode.ts`를 확장한다.

## 3. 로컬 환경 관찰 (참고, 코드 결함 아님)

- `pnpm build`(`vite build`, terser minify)는 이 머신에서 **가끔** `STATUS_STACK_BUFFER_OVERRUN`으로 크래시한다 — 앞선 무거운 프로세스(vitest, Playwright 4-viewport 병렬 실행 등) 직후 재현되었고, 몇 초 후 동일 명령을 재시도하면 항상 성공했다(이번 세션에서 3회 연속 재현: 실패 → 성공 → 성공). Phase 0에서 확인한 esbuild in-process minify 크래시(§00-baseline-audit.md §2.2, 100% 재현)와 달리 이번엔 terser 적용 후에도 남아있는 간헐적 리소스 경합으로 보인다 — Windows 안티바이러스 실시간 스캔 또는 이전 프로세스의 파일 핸들 정리 지연이 유력한 원인이다. 실제 코드 결함이 아니라 로컬 인프라 특성이므로, 이후 Phase들에서 `pnpm build`가 실패하면 **먼저 1회 재시도**하고, 재시도에도 동일하게 실패할 때만 코드 원인으로 조사한다.
- Playwright의 번들 Chromium은 이 세션의 Browser MCP 도구(Phase 0에서 `screenshot`/`zoom`이 항상 타임아웃되던 것)와 달리 스크린샷을 안정적으로 캡처했다 — Phase 0 §11에서 남겨둔 갭을 이 Phase에서 해소했다(`docs/ui-remaster/screenshots/baseline-*.png`로 보강, `00-baseline-audit.md` 갱신).

## 4. Golden 정책

- Golden은 우리 앱의 승인된 셸 화면만 저장한다(`src/test/visual/editor.visual.spec.ts-snapshots/`). 원본 Guitar Pro 8 스크린샷은 절대 여기 포함하지 않는다.
- 파일명은 Playwright가 프로젝트명 + 플랫폼으로 자동 접미사를 붙인다(`editor-shell-visual-1024x768-win32.png` 등) — 이 저장소가 Windows 로컬 환경 기준이므로 플랫폼 접미사가 `win32`로 고정된다. CI를 Linux/Docker로 이전하면 접미사가 `linux`로 바뀌어 golden을 다시 승인해야 한다 — 이는 §5.2("CI Docker/Ubuntu 환경 기준 선언")를 이 저장소가 아직 충족하지 못했다는 뜻이며, 다음 Phase 이후 CI 도입 시 재확인이 필요하다.
- diff 허용치는 Playwright 기본값(`maxDiffPixelRatio` 미지정 → 픽셀 단위 완전 일치에 가까운 기본 임계값)을 그대로 사용한다 — 셸 전체가 크게 바뀌어도 통과하는 느슨한 값을 의도적으로 넣지 않았다.

## 5. 회귀 탐지 실증 (요구사항: "의도적으로 툴바 높이를 바꾸면 visual test가 실패하는 것을 확인하고 되돌린 기록")

1. `src/App.css:56`의 `.gpShell` `grid-template-rows`를 `32px 54px 38px ...` → `32px 94px 38px ...`로 임시 변경(툴바 높이 54px→94px).
2. `pnpm run test:visual` 실행 → **4개 프로젝트 전부 FAIL**(`visual-1024x768`, `visual-1280x768`, `visual-1440x900`: pixel diff; `visual-1920x1080`: "100080 pixels (ratio 0.04) are different").
3. `src/App.css:56`을 원래 값(`54px`)으로 되돌림.
4. `pnpm run test:visual` 재실행 → **4개 프로젝트 전부 PASS**.

## 6. 완료 조건 대비 결과

| 완료 조건 | 상태 | 근거 |
|---|---|---|
| `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm test:visual` 모두 통과 | **PASS** | §7 실행 로그. `pnpm build`는 간헐적 크래시 시 재시도 시 통과(§3) |
| 툴바 높이 변경 시 visual test 실패 확인 후 되돌린 기록 | **PASS** | §5 |
| console error 발생 시 테스트 실패 | **PASS** | `src/test/e2e/editor-shell.spec.ts`의 `failOnConsoleError` auto-fixture가 이 파일의 **모든** 테스트에 적용되어, 한 곳이 아니라 전역적으로 콘솔 에러를 실패로 전환한다 |
| 앱 초기화가 네트워크나 시스템 시간에 의존하지 않음 | **PASS** | §2 조사 결과. 데모 스코어와 셸 렌더링 경로에 `Date.now`/`Math.random` 의존 없음 |

## 7. 실행 결과 로그 (이 세션 실측)

```text
pnpm test         → 15 files / 80 tests passed
pnpm build         → tsc --noEmit 통과, vite build(terser) 통과 (간헐적 재시도 필요, §3)
pnpm run test:e2e  → 6 passed (chromium project)
pnpm run test:visual → 4 passed (1024x768 / 1280x768 / 1440x900 / 1920x1080)
```

## 8. 다음 Phase에 남기는 참고사항

- Phase 2(App.tsx 컨트롤러 분리)부터는 매 단계마다 `pnpm run test:e2e`와 `pnpm run test:visual`을 함께 돌려 회귀를 조기에 잡는다.
- `data-testid`는 필요할 때마다 최소한으로 추가하는 원칙을 유지한다 — 이번 Phase에서 추가한 9개 외에 메뉴바(Phase 6에서 실제 드롭다운이 생긴 뒤 추가 예정)와 문서 탭 전환(Phase 8에서 다중 문서가 실제로 동작한 뒤 추가 예정)은 지금 추가하지 않았다.
- `playwright.config.ts`의 `webServer`는 포트 5174를 전용으로 쓴다 — 로컬에서 수동으로 `npm run dev`(5173)를 띄워놓고 있어도 충돌하지 않는다.
