# Phase 3 — CSS Architecture and Token Inventory

작성일: 2026-07-11

목표: 화면 픽셀과 동작을 유지하면서 `src/App.css` 단일 파일을 토큰 기반 계층 CSS로 분리했다.

## 분리 결과

`src/main.tsx`는 이제 `src/ui/styles/index.css` 하나만 import한다. `index.css`는 아래 순서로 스타일을 불러온다.

- `reset.css`: box sizing, body viewport floor
- `tokens.css`: 색상, 표면, border, radius, control height, shell size, overlay offset, z-index scale
- `base.css`: font face, root typography, base button/input/select, shared focus-visible
- `shell.css`: app shell, menubar, tabs, main grid, panel rails
- `toolbar.css`: toolbar groups, active toggle, LCD, responsive toolbar visibility
- `palette.css`: edition palette sections and command grid
- `workspace.css`: score workspace, viewport, score page display modes
- `inspector.css`: song/track inspector controls
- `global-view.css`: bottom dock, global grid, mixer, automation lanes
- `overlays.css`: command palette, file panel, stylesheet panel, tool windows
- `print.css`: print-only reset isolation

## Selector Inventory

사용 중인 selector는 TSX `className` 검색과 CSS selector 목록을 대조했다. 현재 제품 CSS에 남긴 selector는 모두 런타임 DOM에서 쓰이거나 상태 class로 조합된다.

주요 상태 class:

- `activeToggle`, `automationActive`, `activeTab`, `activeTrack`, `activeCell`
- `selectedSuggestion`, `disabledSuggestion`
- `paletteHidden`, `inspectorHidden`, `globalVisible`, `automationVisible`
- `display-vertical-page`, `display-horizontal-page`, `display-grid`, `display-parchment`, `display-vertical-screen`, `display-horizontal-screen`

제거한 legacy hidden selector:

- `transportLegacy`
- `utilityLegacy`
- `zoomGroup`
- `displayGroup`

이 네 그룹은 JSX에서 렌더되었지만 기존 CSS에서 항상 `display: none`이었다. 동작하는 대체 그룹(`transportGroup`, `playbackTools`, `liveZoomGroup`, `liveDisplayGroup`)이 이미 있으므로 DOM과 CSS에서 제거했다. Visual golden은 1024/1280/1440/1920 전부 동일하게 통과했다.

남긴 responsive-hidden selector:

- `printGroup`
- `.utilityGroup button:nth-last-child(-n + 3)`

이 둘은 1280px 이상에서 다시 표시되는 기존 반응형 동작이므로 legacy로 제거하지 않았다.

미사용 selector:

- 없음. Phase 3 종료 시점의 `rg` 대조에서 `App.css`, `transportLegacy`, `utilityLegacy`, `zoomGroup`, `displayGroup` 참조는 0건이다.

## Token Rules

새 CSS에서는 반복 색상과 치수를 `tokens.css`에 중앙화했다.

- 표면 색상은 `--surface-*`
- 텍스트 색상은 `--text-*`
- 경계선은 `--border-*`
- 강조색은 `--accent-*`
- control height는 `--control-height-*`
- shell geometry는 `--app-*`, `--palette-width`, `--inspector-width`
- overlay 위치와 z-index는 `--overlay-*`, `--z-*`

이번 Phase는 시각 변경을 의도하지 않으므로 기존 녹색/올리브 팔레트 값을 그대로 토큰화했다. GP8 네이비/슬레이트 색상 교체는 후속 Phase에서 semantic token 값만 바꿔 진행한다.

## Naming Rule

기존 className은 리스크를 줄이기 위해 유지한다. 새 class를 추가할 때는 다음 규칙을 따른다.

- 영역 root는 명사형: `toolbar`, `palettePanel`, `scoreViewport`
- 반복 item은 영역 접두사를 유지: `commandSuggestion`, `globalCell`
- 상태는 짧은 형용사/동작형 class로 유지: `activeTrack`, `selectedSuggestion`
- viewport-only patch용 `nth-child` 추가는 금지한다. 기존 `utilityGroup` responsive selector는 Phase 7 overflow 구현 전까지 호환성으로만 남긴다.

