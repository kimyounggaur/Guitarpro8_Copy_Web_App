# GuitarPro8_Copy_Web_App UI/UX 리마스터 바이브코딩 플레이북

> 대상 저장소: `kimyounggaur/Guitarpro8_Copy_Web_App`  
> 기준 브랜치: `main`  
> 작성 기준일: 2026-07-10  
> 목표: 현재 음악 편집·재생 엔진을 보존하면서, Guitar Pro 8 데스크톱 앱의 **정보 구조·화면 밀도·패널 배치·작업 흐름·상호작용 감각**에 최대한 근접하도록 웹 UI를 단계적으로 리마스터한다.

---

## 문서 사용법

이 문서는 한 번에 전부 실행하는 거대한 프롬프트가 아니다. 다음 순서로 사용한다.

1. 새 브랜치에서 **한 세션에 한 Phase만** 진행한다.
2. 각 세션 첫 메시지에 `공통 마스터 컨텍스트 프롬프트`를 붙인다.
3. 이어서 해당 Phase의 `복사해서 사용할 프롬프트`만 붙인다.
4. 에이전트가 코드를 수정하기 전에 지정된 파일을 실제로 읽도록 한다.
5. 매 Phase가 끝날 때 `pnpm test`, `pnpm build`, 해당 Playwright 테스트를 실행한다.
6. 완료 기준을 하나씩 증명하지 못하면 다음 Phase로 넘어가지 않는다.
7. 시각 비교는 합법적으로 확보한 사용자 보유 Guitar Pro 8 스크린샷을 로컬 전용 참조 폴더에 두고 수행한다. 참조 이미지는 공개 저장소에 커밋하지 않는다.

권장 브랜치 이름은 `remaster/phase-00-baseline`, `remaster/phase-01-visual-harness` 형식이다. 한 Phase 안에서도 변경이 크면 `foundation`, `behavior`, `visual-polish` 세 커밋으로 나눈다.

---

# 1. 범위와 지식재산 가드레일

## 1.1 이번 리마스터에서 복제해도 되는 대상

- 화면의 기능적 구획: 상단 메뉴/툴바, 문서 탭, 좌측 에디션 팔레트, 중앙 악보, 우측 인스펙터, 하단 글로벌 뷰와 오디오 트랙.
- 정보 우선순위와 작업 흐름: 악보를 중심에 두고 편집 도구를 주변에 배치하는 방식.
- 패널 열기/닫기, 리사이즈, 도킹, 탭 전환, 단축키, 툴팁, 메뉴 계층, 포커스 이동 같은 상호작용 패턴.
- 화면 밀도, 여백, 대비, 선택 상태, 비활성 상태, 드래그 피드백 같은 일반 UI 특성.
- 저장소의 `specs/*.md`에 이미 정리된 기능 요구사항.

## 1.2 그대로 복사하지 않을 대상

- Guitar Pro 및 Arobas Music의 상표, 로고, 제품명 워드마크.
- 원본 앱에서 추출한 SVG/PNG 아이콘, 비트맵, 전용 폰트, 사운드뱅크, 이펙트 프리셋, 예제 악보, mySongBook 콘텐츠.
- 원본 실행 파일이나 리소스 번들의 역공학 결과.
- 원본 스크린샷을 제품 에셋으로 번들링하는 행위.

릴리스 브랜딩은 별도의 이름과 로고를 사용한다. 아이콘은 `lucide-react` 등 허용된 오픈소스 아이콘을 기반으로 하거나 프로젝트에서 직접 그린 단순 선형 SVG를 사용한다. 원본과 역할은 같아도 경로 데이터는 독립적으로 제작한다.

## 1.3 “동일한 UI/UX”의 실무적 정의

이 문서에서 동일하다는 말은 다음 네 가지를 의미한다.

1. **구조 동등성**: 주요 영역이 같은 위치와 우선순위를 가진다.
2. **행동 동등성**: 같은 목적의 작업이 비슷한 단계 수와 입력 방식으로 끝난다.
3. **밀도 동등성**: 화면에 보이는 정보량과 컨트롤 크기가 데스크톱 전문 도구 수준으로 맞춰진다.
4. **시각 근접성**: 색·간격·크기·정렬·상태 표현을 참조 스크린샷과 수동 오버레이로 교정한다.

픽셀 단위의 수치는 초기 추정값으로 시작하고, 실제 참조 화면을 동일 해상도로 캡처해 측정하면서 보정한다.

---

# 2. 현재 저장소 냉정한 진단

## 2.1 유지해야 할 강점

- React 18 + TypeScript + Vite 기반이며 Zustand와 Immer가 이미 도입되어 있다.
- 음악 문서, 커서/선택, 재생, 환경설정 스토어가 분리되어 있다.
- SVG 악보 렌더러와 편집 명령, 재생 컴파일러, 파일 입출력 기능이 이미 존재한다.
- `commands/registry.ts`, `commands/paletteCommands.ts`, `commands/keymap.ts`를 중심으로 커맨드 단일화 기반이 있다.
- `specs/01-UI-구조와-내비게이션.md`에 6패널 구조와 툴바 그룹이 상세히 정리되어 있다.
- Vitest 단위 테스트가 존재하므로 UI 리팩터링 중 음악 엔진 회귀를 막을 수 있다.

## 2.2 현재 UI의 핵심 문제

| 영역 | 현재 상태 | 리마스터 목표 |
|---|---|---|
| `src/App.tsx` | 편집, 재생, 파일, 패널, 단축키, 명령 라우팅이 한 컴포넌트에 집중 | 컨트롤러 훅으로 분리하고 `App`은 조립 역할만 담당 |
| `EditorShell.tsx` | 툴바, 탭, 팔레트, 인스펙터, 글로벌 뷰가 한 파일에 혼재 | 각 패널을 독립 컴포넌트와 명시적 계약으로 분리 |
| `App.css` | 전역 단일 파일, 녹색/올리브 계열, 고정폭 레이아웃 | 토큰 기반 네이비·슬레이트·블루 시스템과 계층별 CSS |
| 메뉴 | 메뉴 이름만 있는 버튼이며 실제 드롭다운이 없음 | 키보드 탐색 가능한 메뉴와 서브메뉴, 커맨드 레지스트리 연결 |
| 툴바 | 텍스트 버튼이 많고 높이가 크며 기능 그룹이 뒤섞임 | 16–18px 아이콘 중심, 15개 기능 그룹, 오버플로 우선순위 |
| 문서 탭 | 표시만 되고 전환·닫기·추가·미저장 확인이 불완전 | 실제 다중 문서 탭 UX와 컨텍스트 메뉴 |
| 좌측 팔레트 | 3열 텍스트 버튼과 비활성 자리표시자 | 4열 중심 아이콘 그리드, 섹션 접기, 선택 상태, 스크롤 유지 |
| 우측 인스펙터 | Song과 Track이 동시에 세로로 쌓임 | 상단 `SONG` / `TRACK` 탭으로 상호 배타적 전환 |
| 패널 리사이즈 | 좌우·하단 크기가 CSS에 고정 | 드래그 가능한 스플리터와 크기 영속화 |
| 워크스페이스 | 큰 라운드 카드와 과한 패딩/그림자 | 평평한 어두운 작업대 위 종이, 정밀 줌·스크롤·포커스 |
| 글로벌 뷰 | 기능은 있으나 밀도와 행 구조가 목표와 다름 | 트랙 헤더와 마디 셀을 일치시킨 고밀도 도킹 그리드 |
| 오디오 트랙 | 독립된 GP8형 파형 도크가 없음 | 타임라인 공유, 파형, 동기화 컨트롤을 가진 선택적 도크 |
| 홈 화면 | 없음 | New/Open/Search/Recent/Templates/Examples 구조의 런처 |
| 오버레이 | 고정 `absolute` 좌표 패널 | Portal, 포커스 트랩, 충돌 회피, 모달/비모달 구분 |
| 접근성 | 아이콘 의미, 메뉴 포커스, 다이얼로그 포커스가 불완전 | `aria-*`, roving tabindex, Escape 복귀, 포커스 링 |
| 시각 회귀 | Vitest만 있고 브라우저 스냅샷 없음 | Playwright 동작·레이아웃·스크린샷 테스트 |

## 2.3 절대 건드리지 말아야 할 경계

UI Phase 중에는 다음 코드를 “정리한다”는 이유로 재작성하지 않는다.

- `src/model/**`
- `src/engine/editing/**`
- `src/engine/layout/**`
- `src/engine/audio/**`
- `src/engine/unroll/**`
- `src/io/**`

필요한 경우 타입이나 어댑터를 추가할 수 있지만, 음악 도메인 로직 변경은 별도 커밋과 별도 테스트를 요구한다. UI 리마스터 커밋과 섞지 않는다.

---

# 3. 목표 화면 계약

## 3.1 데스크톱 기준 해상도

- 최소 지원: `1024 × 768`
- 주 검수: `1280 × 768`, `1440 × 900`
- 대형 화면: `1920 × 1080`
- 브라우저 줌: 100%
- 운영체제 배율: 기준 캡처는 1x로 통일
- 악보 자체 줌과 브라우저 줌은 별개로 관리

## 3.2 셸 구조

```text
┌──────────────────────────────────────────────────────────────────┐
│ Application menu                                                 │
├──────────────────────────────────────────────────────────────────┤
│ Toolbar groups ─ Transport ─ LCD ─ Loop/Speed ─ Utilities        │
├──────────────────────────────────────────────────────────────────┤
│ Document tabs                                                    │
├──────────────┬───────────────────────────────┬───────────────────┤
│ Edition      │                               │ SONG | TRACK      │
│ palette      │        Score workspace        │ Inspector         │
│              │                               │                   │
├──────────────┴───────────────────────────────┴───────────────────┤
│ Optional audio track waveform dock                               │
├──────────────────────────────────────────────────────────────────┤
│ Global view / mixer / bar overview                               │
└──────────────────────────────────────────────────────────────────┘
```

## 3.3 초기 치수 토큰

다음 값은 첫 구현용 시작점이다. 참조 스크린샷 오버레이 후 ±1~8px 범위로 조정한다.

| 토큰 | 초기값 | 설명 |
|---|---:|---|
| `--app-menu-height` | `26px` | 최상단 메뉴 |
| `--app-toolbar-height` | `50px` | 아이콘 툴바와 LCD |
| `--app-tabs-height` | `25px` | 문서 탭 |
| `--palette-width` | `184px` | 좌측 팔레트 기본폭 |
| `--palette-min-width` | `164px` | 좌측 최소폭 |
| `--palette-max-width` | `236px` | 좌측 최대폭 |
| `--inspector-width` | `212px` | 우측 인스펙터 기본폭 |
| `--inspector-min-width` | `192px` | 우측 최소폭 |
| `--inspector-max-width` | `320px` | 우측 최대폭 |
| `--audio-dock-height` | `118px` | 파형 도크 기본높이 |
| `--global-dock-height` | `166px` | 글로벌 뷰 기본높이 |
| `--dock-min-height` | `92px` | 하단 도크 최소높이 |
| `--splitter-size` | `4px` | 드래그 핸들 |
| `--toolbar-icon-size` | `17px` | 일반 아이콘 |
| `--control-height-sm` | `24px` | 메뉴·작은 버튼 |
| `--control-height-md` | `28px` | 기본 입력·버튼 |

## 3.4 초기 색상 토큰

정확한 원본 색상 추출값이라고 주장하지 않는다. GP8의 네이비·슬레이트·블루 인상을 재현하기 위한 보정 시작점이다.

```css
:root {
  --gp8-bg-app: #191b23;
  --gp8-bg-menubar: #171920;
  --gp8-bg-toolbar: #20232c;
  --gp8-bg-tabs: #6f7892;
  --gp8-bg-panel: #2b2e38;
  --gp8-bg-panel-raised: #353946;
  --gp8-bg-input: #20232b;
  --gp8-bg-workspace: #161820;
  --gp8-bg-global: #252832;
  --gp8-paper: #f5f4ef;

  --gp8-border-subtle: #3e4351;
  --gp8-border: #515766;
  --gp8-border-strong: #697085;

  --gp8-text: #f3f4f7;
  --gp8-text-secondary: #c2c6d0;
  --gp8-text-muted: #8f95a4;
  --gp8-text-disabled: #686e7b;

  --gp8-accent: #5c91f2;
  --gp8-accent-hover: #72a4ff;
  --gp8-accent-pressed: #4677cf;
  --gp8-accent-soft: rgba(92, 145, 242, 0.22);
  --gp8-selection: #e1b94e;
  --gp8-danger: #e06767;
  --gp8-warning: #e6aa4e;
  --gp8-success: #66b58b;

  --gp8-shadow-popover: 0 12px 30px rgba(0, 0, 0, 0.48);
  --gp8-shadow-page: 0 4px 16px rgba(0, 0, 0, 0.42);
}
```

## 3.5 시각 언어

- 앱 UI 글꼴은 운영체제 기본 sans-serif를 사용한다. 음악 기보 폰트와 분리한다.
- 기본 텍스트는 12px, 메뉴·탭은 11–12px, 강조 정보는 13px를 넘기지 않는다.
- 버튼 모서리는 2–4px를 기본으로 한다. 현재의 6–8px 카드형 인상은 줄인다.
- 컨트롤 간 간격은 2/4/6/8px 체계로 제한한다.
- 아이콘 버튼은 텍스트 없이도 의미가 통하도록 툴팁과 `aria-label`을 제공한다.
- 선택은 블루 외곽선/배경, 현재 마디·커서는 노란 계열, 오류는 붉은 계열로 분리한다.
- 비활성 컨트롤은 단순 opacity만 낮추지 말고 텍스트·아이콘·배경 토큰을 함께 바꾼다.
- 종이는 밝게, 주변 작업대는 거의 검은 네이비로 유지한다.

---

# 4. 목표 코드 구조

```text
src/
  app/
    App.tsx
    EditorRoute.tsx
    HomeRoute.tsx
    controllers/
      useEditorController.ts
      usePlaybackController.ts
      useFileController.ts
      usePanelController.ts
      useCommandController.ts

  ui/
    design-system/
      tokens.css
      reset.css
      base.css
      states.css
      IconButton.tsx
      ToolbarButton.tsx
      Tooltip.tsx
      Menu.tsx
      Popover.tsx
      Dialog.tsx
      Tabs.tsx
      SegmentedControl.tsx
      Splitter.tsx
      ScrollArea.tsx
      index.ts

    icons/
      AppIcon.tsx
      iconMap.ts
      custom/

    shell/
      AppShell.tsx
      ApplicationMenuBar.tsx
      TopToolbar.tsx
      ToolbarOverflowMenu.tsx
      TransportControls.tsx
      LcdDisplay.tsx
      DocumentTabs.tsx
      EditorDockLayout.tsx
      StatusBar.tsx

    palette/
      EditionPalette.tsx
      PaletteSection.tsx
      PaletteCommandButton.tsx

    workspace/
      ScoreWorkspace.tsx
      ScoreViewport.tsx
      WorkspaceOverlay.tsx
      ZoomController.tsx

    inspector/
      InspectorDock.tsx
      SongInspector.tsx
      TrackInspector.tsx
      SoundInspector.tsx

    global-view/
      GlobalViewDock.tsx
      TrackHeaderColumn.tsx
      MeasureGrid.tsx
      MixerStrip.tsx

    audio-track/
      AudioTrackDock.tsx
      WaveformCanvas.tsx
      AudioSyncControls.tsx

    home/
      HomeScreen.tsx
      HomeCategoryTabs.tsx
      FileLibraryList.tsx
      FilePreviewPane.tsx

    overlays/
      CommandPalette.tsx
      ToolWindow.tsx
      PreferencesDialog.tsx
      UnsavedChangesDialog.tsx

  store/
    documentStore.ts
    playbackStore.ts
    preferencesStore.ts
    viewStore.ts
    layoutStore.ts
    overlayStore.ts

  test/
    fixtures/
      deterministicScore.ts
    visual/
      editor.visual.spec.ts
      home.visual.spec.ts
      overlays.visual.spec.ts
      screenshot.css
```

기존 파일을 한 번에 이동하지 않는다. 새 컴포넌트를 만들고 어댑터로 연결한 다음, 테스트가 통과할 때마다 이전 구현을 제거한다.

## 4.1 상태 소유권

| 상태 | 소유 스토어 | 금지 사항 |
|---|---|---|
| Score/문서/Undo | `documentStore` | UI 로컬 state에 복제 금지 |
| 커서/선택/활성 스태프 | `viewStore` | 패널별 별도 커서 금지 |
| 재생/루프/속도/믹서 | `playbackStore` | 툴바 내부 별도 상태 금지 |
| 사용 환경설정 | `preferencesStore` | CSS에 사용자 옵션 하드코딩 금지 |
| 패널 가시성/크기/탭/도크 | 신규 `layoutStore` | 음악 문서 JSON에 섞지 않기 |
| 열려 있는 팝오버/모달 | 신규 `overlayStore` 또는 상위 조정자 | 여러 중첩 boolean 난립 금지 |

## 4.2 커맨드 실행 경로

```text
Menu / Toolbar / Palette / Keyboard / Command Palette
                      ↓
             shared command id
                      ↓
        registry + context predicate + execute
                      ↓
       document/view/playback/layout controller
```

같은 동작을 각 컴포넌트에서 다시 구현하지 않는다. 예를 들어 Undo 버튼, Edit 메뉴 Undo, `Ctrl+Z`, 명령 팔레트의 Undo는 모두 `history.undo` 하나를 실행해야 한다.

---

# 5. 품질 게이트

## 5.1 매 Phase 필수 명령

```bash
pnpm install
pnpm test
pnpm build
pnpm exec playwright test
```

Playwright가 도입되기 전 Phase 0에서는 앞의 세 명령만 실행한다. 이후에는 변경 범위에 맞는 테스트를 추가로 실행한다.

## 5.2 시각 검수 규칙

- 참조 화면과 웹앱을 같은 viewport로 캡처한다.
- 브라우저 기본 margin, 스크롤바, 폰트 로딩 상태를 통제한다.
- 애니메이션과 caret blink를 스크린샷 전용 CSS에서 비활성화한다.
- 앱 자체의 Playwright golden은 커밋한다.
- Guitar Pro 8 참조 스크린샷은 `.gitignored`인 `reference-ui/`에만 둔다.
- 자동 픽셀 비교는 우리 앱의 이전 승인본과 수행하고, 원본 앱과의 비교는 수동 오버레이 및 앵커 측정표로 수행한다.
- 기준 이미지는 동일 OS·브라우저·폰트 환경에서 갱신한다.
- 스냅샷 갱신은 `--update-snapshots`를 기계적으로 실행하지 말고 diff를 먼저 검토한다.

## 5.3 핵심 앵커 측정

각 화면에서 다음 값을 `docs/ui-remaster/visual-audit.md`에 기록한다.

- 메뉴바·툴바·탭바 높이
- 좌측·우측 패널 폭
- 하단 도크 높이
- 중앙 LCD 시작 x, 폭, 높이
- 악보 첫 페이지 상단 y
- 팔레트 아이콘 한 칸 크기와 열 수
- 인스펙터 탭 높이
- 글로벌 뷰 트랙 행 높이와 마디 셀 폭
- Command Palette의 폭, 상단 위치, 행 높이

오차 목표는 셸 치수 ±2px, 반복 그리드 셀 ±1px, 색상은 육안 및 대비 기준으로 교정한다.

## 5.4 완료 보고 형식

모든 Phase의 마지막 응답은 반드시 다음 형식을 사용한다.

```text
변경한 파일:
- ...

구현한 동작:
- ...

검증 결과:
- pnpm test: PASS/FAIL
- pnpm build: PASS/FAIL
- Playwright: PASS/FAIL
- 검수 viewport: ...

시각 차이 또는 남은 부채:
- ...

다음 Phase를 막는 문제:
- 없음 / 상세

커밋 제안:
- type(scope): message
```

---

# 6. 공통 마스터 컨텍스트 프롬프트

각 Phase를 시작할 때 아래 블록을 먼저 붙여 넣는다.

```text
너는 `kimyounggaur/Guitarpro8_Copy_Web_App` 저장소의 시니어 프론트엔드 아키텍트이자 데스크톱 음악 편집기 UX 엔지니어다.

이번 작업의 목적은 현재 구현된 음악 문서 모델, SVG 악보 엔진, 편집 커맨드, 재생 엔진, 파일 입출력을 보존하면서 UI 셸과 작업 흐름을 Guitar Pro 8 데스크톱 앱에 매우 가깝게 리마스터하는 것이다.

반드시 지켜야 할 원칙:
1. 작업을 시작하기 전에 요청된 파일과 관련 타입을 실제로 읽고 현재 동작을 요약한다.
2. `src/model`, `src/engine`, `src/io`의 음악 도메인 로직을 UI 정리 명목으로 재작성하지 않는다.
3. Menu, Toolbar, Edition Palette, Keyboard, Command Palette는 같은 command id와 registry를 소비한다. UI 컴포넌트에 중복 실행 로직을 만들지 않는다.
4. Score, cursor/selection, playback, layout UI 상태의 소유권을 분리한다. props와 로컬 state에 같은 사실을 중복 저장하지 않는다.
5. Guitar Pro 로고, 상표, 원본 아이콘 파일, 원본 이미지, 전용 폰트, 사운드뱅크를 복사하지 않는다. 허용된 오픈소스 아이콘 또는 독립 제작 SVG를 사용한다.
6. 참조 스크린샷은 측정·오버레이용일 뿐 앱 에셋으로 import하지 않는다.
7. 기존 기능을 삭제하거나 비활성화해서 화면을 맞추지 않는다. 기존 기능은 새 UI에서 동일하거나 더 나은 접근 경로를 가져야 한다.
8. TypeScript strict 오류, React hook 경고, console error, 접근성 이름 누락을 남기지 않는다.
9. 변경은 작은 단계로 수행하고 각 단계 후 `pnpm test`와 `pnpm build`를 실행한다. Playwright가 설치된 뒤에는 관련 브라우저 테스트도 실행한다.
10. 테스트 실패를 snapshot 갱신이나 assertion 삭제로 숨기지 않는다.
11. CSS 수치를 추측만으로 확정하지 않는다. 토큰화하고 동일 viewport 스크린샷에서 앵커를 측정한 뒤 조정한다.
12. 한 파일이 다시 비대해지지 않도록 UI 컴포넌트, controller hook, store, pure utility를 분리한다.

작업 방식:
- 먼저 현재 구조, 문제, 변경 계획, 위험을 10줄 이내로 보고한다.
- 그다음 코드를 수정한다.
- 중간에 기존 동작과 설계가 충돌하면 기능 보존을 우선하고 adapter를 만든다.
- 완료 후 변경 파일, 동작, 테스트 결과, 시각 검수 viewport, 남은 차이, 제안 커밋 메시지를 보고한다.

현재 Phase의 요구사항만 구현한다. 다음 Phase의 기능을 미리 대규모로 구현하지 않는다.
```

---

# 7. 단계별 실행 프롬프트

## Phase 0 — 읽기 전용 기준선 감사

### 목적

코드를 바꾸기 전에 현재 화면, 컴포넌트 경계, 동작 가능한 기능, 비작동 자리표시자, 브라우저 오류를 증거로 남긴다.

### 복사해서 사용할 프롬프트

```text
[Phase 0: Baseline Audit]

이번 세션은 리마스터 전 기준선 감사다. 제품 동작 코드는 수정하지 말고 문서와 캡처만 추가한다.

반드시 먼저 읽을 파일:
- package.json
- src/App.tsx
- src/App.css
- src/ui/shell/EditorShell.tsx
- src/store/documentStore.ts
- src/store/preferencesStore.ts
- src/store/viewStore.ts
- src/store/playbackStore.ts
- src/commands/registry.ts
- src/commands/paletteCommands.ts
- specs/01-UI-구조와-내비게이션.md

실행 순서:
1. `pnpm install`, `pnpm test`, `pnpm build`를 실행하고 결과를 기록한다.
2. 개발 서버를 띄워 1024×768, 1280×768, 1440×900, 1920×1080에서 에디터 초기 화면을 캡처한다.
3. 다음 상호작용을 직접 시험한다.
   - F2/F5/F6/F8/F10 패널 토글
   - 메뉴 버튼 클릭
   - 문서 탭 클릭, + 버튼, 탭 닫기 가능 여부
   - 좌우·하단 패널 리사이즈 가능 여부
   - 재생, 정지, 루프, 속도 변경
   - 에디션 팔레트에서 duration/effect 입력
   - Command Palette 열기와 명령 실행
   - Stylesheet/File I/O/Track/Tool 패널 열기
   - 새 파일, 열기, 저장
4. 각 항목을 `working`, `partial`, `placeholder`, `broken`으로 분류한다.
5. 브라우저 console error/warning, overflow, 잘린 버튼, 접근성 이름 누락을 수집한다.
6. `src/App.tsx`, `EditorShell.tsx`, `App.css`의 책임을 함수·컴포넌트·selector 단위로 표로 만든다.
7. UI 변경 시 회귀 위험이 큰 코드 경로를 최소 10개 식별한다.

생성할 파일:
- docs/ui-remaster/00-baseline-audit.md
- docs/ui-remaster/00-interaction-matrix.md
- docs/ui-remaster/00-component-map.md
- docs/ui-remaster/screenshots/baseline-1024x768.png
- docs/ui-remaster/screenshots/baseline-1280x768.png
- docs/ui-remaster/screenshots/baseline-1440x900.png
- docs/ui-remaster/screenshots/baseline-1920x1080.png

감사 문서에 반드시 포함할 내용:
- 현재 기술 스택과 테스트 명령
- 실제 레이아웃 치수
- 현재 색상/간격/라운드/글꼴 요약
- 기능 진입점별 command id 매핑 여부
- 비작동 메뉴와 탭 목록
- 고정 absolute 좌표를 사용하는 overlay 목록
- UI 리팩터링에서 보호해야 할 음악 엔진 경계
- 다음 Phase에서 먼저 고쳐야 할 순서와 이유

금지:
- App.tsx 리팩터링
- CSS 색상 변경
- 라이브러리 설치
- snapshot 기준을 임의 생성해 PASS라고 보고하기

완료 조건:
- 네 viewport 캡처가 존재한다.
- 모든 검사 항목에 실제 결과가 있다.
- `pnpm test`와 `pnpm build` 결과가 문서에 기록되어 있다.
- git diff에는 문서와 캡처 외 제품 코드 변경이 없다.

권장 커밋:
- docs(ui-remaster): capture pre-remaster baseline
```

---

## Phase 1 — Playwright 동작·시각 회귀 하네스

### 목적

UI를 바꾸기 전에 승인된 우리 앱 화면과 핵심 동작을 자동으로 보호한다.

### 복사해서 사용할 프롬프트

```text
[Phase 1: Browser and Visual Regression Harness]

현재 Vitest 테스트를 유지하면서 Playwright 기반 브라우저 동작·시각 회귀 환경을 추가하라.

먼저 읽을 파일:
- package.json
- vite.config.ts
- vitest.config.ts
- src/main.tsx
- src/App.tsx
- src/model/demoScore.ts
- docs/ui-remaster/00-baseline-audit.md

구현 요구사항:
1. 현재 lockfile과 Node 환경에 맞는 `@playwright/test`를 devDependency로 설치한다.
2. package.json에 다음 의미의 script를 추가한다.
   - `test:e2e`: 브라우저 동작 테스트
   - `test:visual`: Chromium 시각 테스트
   - `test:visual:update`: 의도적 golden 갱신
3. `playwright.config.ts`를 만들고 Vite dev server를 자동 실행한다.
4. 기본 프로젝트는 Chromium 하나로 시작한다. viewport 프로젝트는 1024×768, 1280×768, 1440×900, 1920×1080을 정의하거나 parameterized test로 구성한다.
5. URL query `?testMode=visual`일 때만 다음 결정론적 처리를 하라.
   - demo score 고정
   - 날짜/랜덤 ID/현재 시간에 의존하는 텍스트 고정
   - 애니메이션, transition, caret blink 제거
   - 재생 위치는 정지 상태로 고정
6. 실제 제품 경로에서는 testMode가 동작이나 데이터를 변경하지 않아야 한다.
7. `src/test/visual/screenshot.css`를 만들고 transition/animation/caret만 안정화한다. 레이아웃을 숨기거나 왜곡하지 않는다.
8. 다음 테스트를 작성한다.
   - 초기 에디터가 열린다.
   - F2로 팔레트가 숨고 다시 열린다.
   - F5/F6로 Inspector 표시 상태가 바뀐다.
   - F8로 Global View가 토글된다.
   - Command Palette가 열리고 Escape로 닫힌다.
   - 재생 버튼이 playing/stop 상태를 왕복한다.
   - 4개 viewport의 전체 화면 screenshot.
9. 안정적인 `data-testid`가 필요한 곳에만 추가한다. CSS class나 한글/영문 표시 문자열을 locator의 유일한 근거로 사용하지 않는다.
10. Playwright 결과물 디렉터리, trace/video 정책, CI용 설정을 `.gitignore`와 문서에 반영한다.

스크린샷 정책:
- golden은 우리 앱 승인 화면만 저장한다.
- 운영체제에 따른 폰트 차이가 크면 CI Docker/Ubuntu 환경을 기준으로 선언한다.
- 처음에는 합리적인 diff 허용치를 사용하되 shell 전체가 크게 바뀌어도 PASS하는 느슨한 값은 금지한다.
- 테스트마다 `await document.fonts.ready`와 UI 안정 상태를 기다린다.

생성/수정 예상 파일:
- package.json
- pnpm-lock.yaml
- playwright.config.ts
- src/test/visual/editor.visual.spec.ts
- src/test/e2e/editor-shell.spec.ts
- src/test/visual/screenshot.css
- 필요 최소 범위의 testMode utility
- docs/ui-remaster/01-visual-testing.md

완료 조건:
- `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm test:visual`이 모두 통과한다.
- 의도적으로 툴바 높이를 바꾸면 visual test가 실패하는 것을 한 번 확인하고 되돌린 기록이 있다.
- console error가 발생하면 테스트가 실패한다.
- 앱 초기화가 네트워크나 시스템 시간에 의존하지 않는다.

권장 커밋:
- test(ui): add deterministic Playwright visual regression harness
```

---

## Phase 2 — `App.tsx` 컨트롤러 분리

### 목적

시각 변경 전에 이벤트 오케스트레이션을 분리해 이후 UI 교체가 음악 엔진을 흔들지 않게 한다.

### 복사해서 사용할 프롬프트

```text
[Phase 2: Extract App Controllers Without UX Changes]

이번 Phase는 구조 리팩터링만 한다. 화면 픽셀과 사용자 동작은 의도적으로 바꾸지 않는다.

먼저 읽을 파일:
- src/App.tsx 전체
- src/ui/shell/EditorShell.tsx
- src/store/*.ts
- src/commands/*.ts
- src/engine/editing/types.ts
- Phase 1 Playwright 테스트

목표 구조:
- `src/app/App.tsx`: store 구독, controller 조립, route/shell 렌더만 담당
- `src/app/controllers/useEditorController.ts`
- `src/app/controllers/usePlaybackController.ts`
- `src/app/controllers/useFileController.ts`
- `src/app/controllers/useCommandController.ts`
- `src/app/controllers/useToolWindowController.ts`

구체적 작업:
1. App.tsx의 함수와 state를 책임별로 분류한 뒤 이동 순서를 제안한다.
2. 편집 관련 함수는 `EditorController` 형태로 묶되 기존 pure operation을 그대로 호출한다.
3. PlaybackScheduler ref와 start/stop/seek 관련 로직은 playback controller로 옮긴다.
4. File System Access API, input fallback, import/export/download 로직은 file controller로 옮긴다.
5. Command Palette parsing과 `runAppAction`은 command controller로 옮긴다. 기존 command id는 바꾸지 않는다.
6. tool/track/stylesheet/file panel open state는 임시 tool window controller로 옮긴다. 다음 Phase에서 overlay store로 교체하기 쉽게 discriminated union을 사용한다.
7. 전역 keydown listener는 controller가 등록하되 텍스트 입력 예외와 cleanup을 보존한다.
8. controller return 객체는 stable callback과 명시적 타입을 가진다. 거대한 익명 object를 JSX에 직접 만들지 않는다.
9. App.tsx는 250줄 이내를 목표로 하며, 각 controller도 500줄을 넘으면 하위 utility로 나눈다.
10. 순환 import를 만들지 않는다. UI 계층이 engine을 직접 변경하는 새 경로를 추가하지 않는다.

테스트 요구사항:
- 기존 Vitest 전부 통과
- Phase 1 E2E/visual golden 변경 없음
- 최소한 command controller의 app action routing 단위 테스트 추가
- file controller의 format→handler 매핑 단위 테스트 추가
- 재생 controller cleanup 테스트 또는 브라우저 E2E 추가

금지:
- className, DOM 계층, CSS, 표시 문자열 변경
- command id 이름 변경
- 음악 데이터 모델 수정
- 리팩터링과 새 기능을 한 커밋에 섞기

완료 조건:
- App.tsx가 조립 책임 중심으로 줄어든다.
- visual screenshot에 의도적 차이가 없다.
- 새 controller의 공개 계약이 타입으로 문서화된다.
- 모든 테스트가 통과한다.

권장 커밋:
- refactor(app): extract editor playback file and command controllers
```

---

## Phase 3 — CSS 토큰화와 계층 분리

### 목적

색상 교체보다 먼저 전역 CSS의 책임을 나누고, 이후 수치 보정을 한 곳에서 수행할 기반을 만든다.

### 복사해서 사용할 프롬프트

```text
[Phase 3: CSS Architecture and Tokens, No Intentional Visual Change]

현재 `src/App.css`를 분석하고 cascade 충돌 없이 계층화하라. 이번 Phase에서는 최종 GP8 색상으로 바꾸지 말고 현재 화면을 최대한 유지한다.

먼저 읽을 파일:
- src/App.css 전체
- src/main.tsx
- 모든 TSX에서 사용되는 className 검색 결과
- Phase 1 visual tests

구현 요구사항:
1. CSS selector inventory를 만들어 사용 중, 중복, legacy hidden, 미사용으로 분류한다.
2. 다음 파일로 나눈다.
   - src/ui/styles/tokens.css
   - src/ui/styles/reset.css
   - src/ui/styles/base.css
   - src/ui/styles/shell.css
   - src/ui/styles/toolbar.css
   - src/ui/styles/palette.css
   - src/ui/styles/workspace.css
   - src/ui/styles/inspector.css
   - src/ui/styles/global-view.css
   - src/ui/styles/overlays.css
   - src/ui/styles/print.css
   - src/ui/styles/index.css
3. 가능하면 `@layer reset, tokens, base, components, layout, utilities`를 사용해 우선순위를 명시한다.
4. 현재 반복되는 색상, border, radius, control height, spacing, z-index를 semantic token으로 치환한다.
5. `transportLegacy`, `utilityLegacy`, 숨겨진 zoom/display duplicate처럼 현재 사용되지 않는 legacy 블록은 DOM 사용 여부를 증명한 뒤 제거한다.
6. 임의의 높은 z-index 대신 z-index scale을 토큰화한다.
7. 모든 input/button/select의 focus-visible 스타일을 공통화한다.
8. print CSS가 화면 CSS와 충돌하지 않도록 별도 layer/media로 분리한다.
9. `main.tsx`는 새 `styles/index.css`만 import하게 한다.
10. 새로운 class naming 규칙을 문서화하되 전체를 한 번에 rename하지 않는다.

검증:
- visual golden에서 허용되지 않은 차이가 없어야 한다.
- CSS build warning 0개
- 사용하지 않는 selector 목록을 문서에 남긴다.
- 1024px에서 overflow가 이전보다 나빠지지 않는다.

완료 조건:
- App.css는 제거되거나 compatibility import만 남는다.
- 색상과 치수가 토큰으로 중앙화된다.
- 테스트와 build가 통과한다.
- 스크린샷 diff는 폰트 렌더링 수준 외 실질 차이가 없다.

권장 커밋:
- refactor(ui): split global stylesheet into tokenized layers
```

---

## Phase 4 — 접근 가능한 UI 프리미티브와 독립 아이콘 체계

### 목적

텍스트/Unicode 임시 버튼을 교체할 공통 버튼, 툴팁, 메뉴, 팝오버, 탭, 다이얼로그, 아이콘 계약을 만든다.

### 복사해서 사용할 프롬프트

```text
[Phase 4: Design-system Primitives and Original Icon System]

최종 셸을 만들기 전에 재사용 가능한 접근성 프리미티브를 추가하라. 아직 모든 기존 UI를 교체하지 말고 Story/Demo 또는 test fixture에서 검증한다.

먼저 읽을 파일:
- package.json
- src/ui/shell/EditorShell.tsx
- src/commands/registry.ts
- src/commands/keymap.ts
- src/ui/styles/*

의존성 원칙:
- 아이콘은 허용된 오픈소스 패키지를 사용하되 tree-shaking 가능한 named import만 사용한다.
- 메뉴/다이얼로그/툴팁은 키보드 포커스 관리가 검증된 headless primitive를 사용해도 된다.
- 리사이즈 패널 라이브러리는 이 Phase에서 설치하지 않는다.
- 새 의존성마다 라이선스와 번들 비용을 `docs/ui-remaster/dependencies.md`에 기록한다.

필수 컴포넌트:
1. `IconButton`
   - size: xs/sm/md
   - selected/pressed/danger/disabled
   - 필수 accessible label
   - tooltip과 shortcut 표시
2. `ToolbarButton`
   - command id 기반 enabled/selected/tooltip
   - click 시 registry dispatcher 호출
3. `Tooltip`
   - hover와 keyboard focus 모두 지원
   - 짧은 지연, viewport collision 처리
4. `Menu`, `MenuItem`, `MenuSeparator`, `Submenu`
   - Arrow, Home/End, Enter/Space, Escape, typeahead
   - shortcut column과 checked/disabled 상태
5. `Popover`
   - anchor collision, outside click, Escape
6. `Dialog`
   - Portal, overlay, focus trap, title/description, focus restore
7. `Tabs`
   - roving tabindex, Arrow 이동, manual/automatic activation 옵션
8. `SegmentedControl`
9. `SplitterHandle`
   - 실제 resize 로직은 다음 Phase, 여기서는 시각/ARIA 계약
10. `AppIcon`
   - `name`, `size`, `strokeWidth`, `decorative`

아이콘 규칙:
- 원본 앱 아이콘 파일을 추출하거나 tracing하지 않는다.
- 기본 stroke 1.75, 크기 16 또는 18px.
- 악보 특화 아이콘은 자체 SVG로 그리되 단순 기하와 SMuFL glyph 조합을 사용한다.
- Unicode 문자 `⚙`, `♫`, `⌂`를 최종 툴바 아이콘으로 사용하지 않는다.
- icon name→component 매핑을 한 파일에서 관리하고 문자열 오타를 타입으로 막는다.

테스트:
- 각 primitive의 keyboard interaction 테스트
- accessible name 누락 시 개발 환경 경고 또는 타입 오류
- Dialog focus restore 테스트
- Menu submenu와 disabled item 테스트
- Tooltip이 pointer와 focus에서 모두 보이는지 테스트

완료 조건:
- primitives demo 페이지 또는 테스트 fixture에서 모든 상태를 볼 수 있다.
- 제품 UI는 일부만 교체해도 되지만 기존 동작을 바꾸지 않는다.
- 새 의존성 라이선스 기록이 있다.
- build/test/Playwright가 통과한다.

권장 커밋:
- feat(ui): add accessible desktop editor primitives and icon system
```

---

## Phase 5 — GP8형 셸 기하·도킹·스플리터

### 목적

최종 색과 세부 아이콘보다 먼저 전체 앱의 공간 구조를 목표 형태로 고정한다.

### 복사해서 사용할 프롬프트

```text
[Phase 5: Remaster App Shell Geometry and Resizable Docks]

현재 6패널 DOM을 분리하고, Guitar Pro 8과 같은 전문 데스크톱 편집기 셸 기하를 구현하라. 음악 편집 기능은 그대로 연결한다.

먼저 읽을 파일:
- src/ui/shell/EditorShell.tsx
- src/ui/styles/shell.css
- src/store/preferencesStore.ts
- src/store/viewStore.ts
- specs/01-UI-구조와-내비게이션.md의 6패널 부분
- Phase 0 측정표

새 구조:
- AppShell
  - ApplicationMenuBar slot
  - TopToolbar slot
  - DocumentTabs slot
  - EditorDockLayout
    - left EditionPalette
    - center ScoreWorkspace
    - right InspectorDock
    - optional AudioTrackDock
    - bottom GlobalViewDock

구현 요구사항:
1. `EditorShell.tsx`에서 위 영역을 각각 파일로 추출한다. 첫 단계에서는 기존 JSX를 그대로 옮겨 동작을 보존한다.
2. 신규 `layoutStore.ts`를 만든다.
   - leftVisible/rightVisible/audioVisible/globalVisible
   - leftWidth/rightWidth/audioHeight/globalHeight
   - activeInspectorTab
   - panel sizes를 localStorage에 versioned schema로 저장
   - 손상된 저장값은 clamp 후 fallback
3. 좌우 패널과 하단 두 도크에 Pointer Events 기반 splitter를 구현하거나 검증된 resizable panel primitive를 사용한다.
4. 스플리터 요구사항:
   - pointer capture
   - 키보드 Arrow로 8px씩 조정, Shift+Arrow로 24px
   - `role=separator`, orientation, aria-valuenow/min/max
   - double click 시 기본값 복원
   - 드래그 중 iframe/SVG selection 방지
5. 패널을 숨기면 splitter도 사라지고 중앙 작업영역이 즉시 확장되어야 한다.
6. 1024×768에서 중앙 악보 영역이 최소 420px 폭을 확보하도록 우선순위를 정한다. 부족하면 좌우 패널을 자동 축소하되 사용자 visible 상태를 영구 변경하지 않는다.
7. 하단 audio/global 도크가 둘 다 열리면 각각 독립 리사이즈되며 총합이 중앙 영역을 침범하지 않게 clamp한다.
8. 패널 크기 변경은 Score 문서 dirty 상태를 만들지 않는다.
9. F2/F5/F6/F8/F10 단축키를 새 layoutStore에 연결하되 기존 command path를 유지한다.
10. 셸 배경, 경계, radius, padding을 목표 토큰의 시작값으로 변경한다.

시각 목표:
- menu 26px, toolbar 약 50px, tabs 약 25px.
- 좌측 184px, 우측 212px, global 166px 시작.
- splitter는 4px 시각폭이나 hit area는 8px 이상.
- score viewport를 둘러싼 과한 8px radius 카드 인상을 제거.
- 패널 경계는 1px slate line으로 일관.

테스트:
- 각 splitter drag와 keyboard resize
- 새로고침 후 size 복원
- invalid localStorage recovery
- 패널 토글 후 중앙 영역 치수
- 네 viewport visual test 갱신 및 승인 사유 기록

완료 조건:
- DOM상 각 패널이 독립 컴포넌트다.
- 패널 크기와 가시성이 영속화된다.
- 1024×768에서 주요 컨트롤이 겹치지 않는다.
- 음악 입력/재생/파일 동작이 유지된다.

권장 커밋:
- feat(shell): add resizable persistent GP8-style editor dock layout
```

---

## Phase 6 — 실제 동작하는 애플리케이션 메뉴

### 목적

현재 메뉴 이름 버튼을 계층형 데스크톱 메뉴로 교체하고 모든 항목을 기존 커맨드 레지스트리에 연결한다.

### 복사해서 사용할 프롬프트

```text
[Phase 6: Functional Desktop Menubar]

`MENU_TREE`와 command registry를 단일 소스로 사용해 실제 동작하는 메뉴바를 구현하라.

먼저 읽을 파일:
- src/commands/paletteCommands.ts의 MENU_TREE 전체
- src/commands/registry.ts
- src/commands/keymap.ts
- src/app/controllers/useCommandController.ts
- 현재 ApplicationMenuBar/MenuBar 구현

구현 요구사항:
1. 메뉴 구조를 UI 전용 하드코딩 배열로 다시 만들지 않는다. MENU_TREE에 필요한 group/separator/submenu/check/radio 메타데이터를 타입 안전하게 확장한다.
2. 상단 메뉴는 File, Edit, Track, Bar, Note, Effects, Section, Tools, View, Sound, Help 순서를 보존한다.
3. 메뉴 항목은 다음 정보를 보여준다.
   - label
   - 선택/체크 상태
   - shortcut label
   - submenu chevron
   - disabled state와 필요 시 이유 tooltip
4. commandId가 있으면 registry로 실행하고, appAction은 command controller의 단일 dispatcher로 실행한다.
5. 메뉴를 연 채 좌우 Arrow로 인접 최상위 메뉴를 이동한다.
6. Up/Down/Home/End/Enter/Space/Escape/typeahead를 지원한다.
7. 메뉴 실행 후 원래 trigger에 focus를 복원한다.
8. View 메뉴의 패널 항목과 display mode는 현재 layout/document 상태를 체크 표시한다.
9. 최근 파일, Import, Export 같이 동적 하위항목을 위한 adapter 슬롯을 만든다.
10. 브라우저 기본 context menu와 충돌하지 않는다.
11. macOS/Windows shortcut label을 현재 platform util에서 가져온다.
12. menu item 클릭 로직을 컴포넌트 내부 switch로 구현하지 않는다.

테스트:
- keyboard-only로 File→Save As 실행
- 좌우 메뉴 전환
- disabled 항목 미실행
- View의 checked 상태가 panel toggle과 동기화
- menu와 keyboard shortcut가 같은 command id를 호출
- Escape focus restore

시각 목표:
- 메뉴바 높이 26px.
- 최상위 항목은 투명 배경, 열렸을 때 slate/blue highlight.
- 메뉴 폭은 label과 shortcut을 수용하되 과도하게 넓지 않게 한다.
- submenu는 1px border와 강한 shadow, radius 3–4px.

완료 조건:
- 단순 버튼이 아닌 완전한 메뉴가 작동한다.
- MENU_TREE와 실제 메뉴 차이를 검사하는 테스트가 있다.
- 기존 command palette의 Action List가 같은 메뉴 데이터를 계속 사용한다.

권장 커밋:
- feat(menu): connect accessible desktop menus to shared command registry
```

---

## Phase 7 — 상단 툴바·트랜스포트·LCD 리마스터

### 목적

텍스트가 많은 현재 툴바를 GP8형 고밀도 아이콘 그룹과 중앙 LCD로 재구성한다.

### 복사해서 사용할 프롬프트

```text
[Phase 7: Top Toolbar, Transport and LCD Parity]

상단 툴바를 15개 기능 그룹의 고밀도 데스크톱 툴바로 재구성하라. 기존 기능은 삭제하지 말고 icon/overflow/menu 진입점으로 보존한다.

먼저 읽을 파일:
- 현재 TopToolbar/Toolbar 구현
- specs/01-UI-구조와-내비게이션.md의 Toolbar와 LCD 부분
- src/commands/registry.ts
- src/commands/keymap.ts
- playbackStore, viewStore, layoutStore
- Phase 0 toolbar 캡처와 측정

목표 그룹 순서:
1. Home
2. panel visibility toggles
3. zoom
4. display modes
5. undo/redo
6. print
7. transport/navigation
8. LCD
9. loop/speed
10. global tonality
11. audio track
12. instrument views
13. tuner
14. line-in
15. optional Fretlight/overflow

구현 요구사항:
1. 기존 `+Trk`, `Tune`, `Vox`, `Cmd`, `Style`, `Chord` 같은 텍스트 버튼을 기본 툴바에서 제거하고 의미가 맞는 독립 아이콘+tooltip으로 교체한다. 기능은 Tools/Menu/overflow에 남긴다.
2. 모든 버튼은 `ToolbarButton` 또는 command-aware wrapper를 사용한다.
3. 그룹 사이에 1px separator와 4–6px 내부 간격을 사용한다.
4. ResizeObserver로 가용 폭을 측정하고 낮은 우선순위 그룹부터 overflow menu로 이동한다. 단순 CSS `display:none`으로 기능을 잃지 않는다.
5. 1024px에서도 Home, panel toggles, transport, LCD, play, loop/speed는 항상 보인다.
6. Transport는 first/previous/play-stop/next/last의 명확한 시각 순서와 pressed 상태를 가진다.
7. LCD는 다음을 표시하고 상호작용한다.
   - 현재 트랙 색상 및 short name; 클릭 시 트랙 선택 popover
   - 현재 BPM; 클릭 시 tempo automation 진입
   - 현재 마디 실제/이론 길이; 오류 시 red warning + 상세 tooltip
   - 현재 bar/beat 또는 playback time
   - count-in, metronome, settings 버튼
8. tempo `120` 하드코딩을 제거하고 score/playback automation에서 현재 값을 계산한다. 아직 API가 없으면 selector adapter를 만들고 fallback 근거를 주석으로 남긴다.
9. loop와 speed control은 selected state를 공유하고 25–200% 범위를 명시한다.
10. Audio Track 버튼은 오디오가 연결된 경우 blue outline, 도크가 열려 있으면 selected fill을 사용한다.
11. 현재 트랙 색상은 LCD 또는 툴바에 항상 보여야 한다.
12. tooltip에는 실제 platform shortcut label을 포함한다.
13. 장식 icon은 `aria-hidden`; icon-only 버튼은 `aria-label` 필수.

시각 목표:
- 툴바 높이 48–52px.
- 대부분의 icon button hit box 28×28px, icon 16–18px.
- LCD는 어두운 inset surface, 약 280–360px 가변폭.
- selected는 blue, 오류는 red, 현재 트랙 color는 작은 vertical marker.
- 텍스트는 LCD와 속도 수치 외 최소화.

테스트:
- 1024/1280/1440/1920 overflow 구성 스냅샷
- overflow 안에서도 command 실행
- LCD track popover와 선택 동기화
- 실제 bar duration warning
- play/stop, metronome, count-in, loop selected 상태
- 모든 icon button accessible name 검사

완료 조건:
- 중복 legacy toolbar DOM/CSS가 제거된다.
- 기능이 overflow 때문에 사라지지 않는다.
- 툴바의 모든 action이 shared command/app-action path를 사용한다.
- 네 viewport에서 잘림이나 겹침이 없다.

권장 커밋:
- feat(toolbar): remaster transport LCD and responsive command groups
```

---

## Phase 8 — 실제 다중 문서 탭 UX

### 목적

표시용 탭을 실제 문서 전환·추가·닫기·미저장 확인·컨텍스트 메뉴가 가능한 데스크톱 문서 탭으로 만든다.

### 복사해서 사용할 프롬프트

```text
[Phase 8: Functional Multi-document Tabs]

현재 `documentStore`의 단일 demo 문서 구조를 안전하게 확장하고, 문서 탭을 실제 작업 흐름으로 구현하라.

먼저 읽을 파일:
- src/store/documentStore.ts
- src/app/controllers/useFileController.ts
- src/ui/shell/DocumentTabs.tsx 또는 기존 TabBar
- src/model/types.ts
- native save/load 관련 코드
- undo/redo 호출 경로

데이터 설계 요구사항:
1. 문서마다 다음 상태를 독립 보관한다.
   - id
   - title
   - score
   - dirty
   - locked/readOnly
   - fileHandle 또는 persistence key의 안전한 참조
   - undoStack/redoStack
   - document-specific view state가 필요하면 별도 map
2. `score`와 `undoStack`이 전역 한 벌인 현재 구조를 문서별 세션으로 전환한다.
3. 활성 문서를 바꿀 때 cursor/selection을 normalize하고 playback을 안전하게 중지한다.
4. 저장 시 해당 문서만 clean으로 바뀌어야 한다.
5. id는 안정적이고 충돌하지 않아야 하며 testMode에서는 결정론적이어야 한다.
6. 기존 store 소비 코드를 한 번에 깨지 않도록 selector/compatibility adapter를 제공한다.

탭 UX 요구사항:
1. 탭을 클릭하면 문서가 전환된다.
2. 활성 탭, 비활성 탭, dirty dot, locked icon, hover close 상태를 구분한다.
3. middle click과 close button으로 닫기를 지원한다.
4. dirty 문서를 닫을 때 Save / Don't Save / Cancel 다이얼로그를 연다.
5. 마지막 문서를 닫으면 Home으로 이동하거나 새 빈 문서를 만드는 정책을 명시하고 일관되게 적용한다.
6. `+` 버튼은 새 문서 생성 메뉴 또는 즉시 새 악보를 만든다.
7. 탭 overflow 시 horizontal scroll 또는 chevron list를 제공한다. 탭을 무한히 축소해 제목을 완전히 잃지 않는다.
8. 컨텍스트 메뉴: Close, Close Others, Close Tabs to Right, Save, Reveal file action이 가능한 범위에서 제공된다.
9. 단축키:
   - Ctrl/Cmd+N 새 문서
   - Ctrl/Cmd+W 닫기
   - Ctrl+Tab / Ctrl+Shift+Tab 문서 이동
   - Ctrl/Cmd+1..9 선택은 브라우저 충돌을 검토하고 지원 여부를 문서화
10. 탭 순서 drag reorder는 이번 Phase에서 구현하거나, 구현하지 않으면 명시적 후속 항목으로 남긴다. 어설픈 drag는 금지한다.

시각 목표:
- 탭바 높이 24–26px.
- slate blue strip 위에 활성 탭은 더 밝거나 workspace와 연결된 형태.
- dirty는 작은 점, close는 hover/active에만 선명.
- 탭 모서리는 2–3px이며 브라우저 탭처럼 과하게 둥글지 않다.

테스트:
- 두 문서 생성→각각 편집→전환 시 내용과 undo 독립성
- dirty 저장/닫기 세 갈래
- active document 재생 중 전환 시 정지
- keyboard tab cycling
- overflow viewport visual test
- 새로고침 persistence 범위가 의도와 일치하는지

완료 조건:
- 탭이 실제 문서 세션을 대표한다.
- 문서별 dirty/undo가 섞이지 않는다.
- close confirmation과 focus 복원이 정상이다.
- 기존 파일 열기/저장이 활성 문서에만 적용된다.

권장 커밋:
- feat(documents): implement independent multi-document editor tabs
```

---

## Phase 9 — 좌측 에디션 팔레트 리마스터

### 목적

텍스트 위주의 3열 팔레트를 고밀도 아이콘 명령 팔레트로 바꾸고, 현재 선택·활성·적용 가능 상태를 정확히 보여준다.

### 복사해서 사용할 프롬프트

```text
[Phase 9: Edition Palette Parity]

좌측 Edition Palette를 전문 악보 편집기 수준으로 재설계하라. command 실행 경로와 기존 편집 기능은 그대로 유지한다.

먼저 읽을 파일:
- 현재 EditionPalette/PaletteGroup 구현
- noteDurations, barSymbolButtons, noteEffectButtons, beatEffectButtons 정의
- src/commands/editingCommands.ts
- src/commands/registry.ts
- src/engine/editing/operations.ts의 command가 소비하는 상태
- specs/03-기보법-심볼과-이펙트.md의 입력 UX 부분

구조 요구사항:
1. 팔레트 섹션을 데이터 정의로 이동한다.
   - id
   - label
   - command ids
   - column count
   - defaultExpanded
   - context predicate
2. 기본 섹션:
   - Voices
   - Design
   - Lyrics
   - Chords
   - Bar symbols
   - Note values/symbols
   - Note effects
   - Beat effects
   - Notation symbols
   - Automation
3. 아직 동작하지 않는 명령은 가짜 성공 버튼으로 만들지 않는다. disabled와 이유 tooltip 또는 `coming later` 상태로 구분한다.
4. Voice 1–4와 Multivoice는 상단의 작고 명확한 segmented/toggle control로 구성한다.
5. 명령 버튼은 기본 4열 그리드, 복잡한 기호는 3열/2열을 데이터로 지정할 수 있다.
6. 팔레트 폭 리사이즈에 따라 3–5열로 변하지 말고 아이콘 크기와 간격을 안정적으로 유지한다. 남는 공간만 좌우 여백에 반영한다.
7. 각 명령은 독립 제작 icon 또는 music glyph를 사용한다. label은 tooltip/accessible name으로 제공한다.
8. current cursor의 note/beat/bar 상태를 selector로 읽어 적용 중인 toggle을 blue selected로 표시한다.
9. context상 실행 불가능한 버튼은 registry predicate와 동일한 이유로 disabled되어야 한다.
10. 섹션 header click으로 접기/펼치기, chevron, count/상태 표시를 제공한다.
11. 펼침 상태와 scroll position을 layoutStore에 저장한다.
12. 우클릭 추가 옵션이 있는 명령은 context menu 또는 small chevron split-button으로 제공하되 기본 클릭과 구분한다.
13. hover 시 기호 이름, shortcut, 현재 적용 여부를 툴팁에 표시한다.
14. F2 토글 후 다시 열면 이전 scroll/section 상태가 유지된다.

시각 목표:
- 폭 약 184px.
- section header 22–24px, uppercase 또는 compact semibold.
- button cell 약 34–38px, icon 17–20px.
- gap 2–4px, radius 2–3px.
- scrollbar는 얇고 panel tone에 맞춘다.
- disabled placeholder는 UI를 지저분하게 채우지 않도록 섹션 단위로 접거나 명확히 흐리게 한다.

테스트:
- duration/effect/bar symbol command 실행
- active note effect selected 표시
- cursor context 변경 시 disabled/selected 동기화
- section persistence와 scroll restoration
- keyboard grid navigation: Arrow/Home/End/Enter/Space
- 164/184/236px panel width visual test

완료 조건:
- 텍스트 임시 버튼이 아이콘 중심의 조밀한 팔레트로 교체된다.
- 모든 버튼이 command id로 실행된다.
- 활성 상태가 실제 score 데이터를 반영한다.
- F2 및 resize 동작에 회귀가 없다.

권장 커밋:
- feat(palette): rebuild edition palette as contextual command grid
```

---

## Phase 10 — 중앙 악보 워크스페이스와 스크롤·줌

### 목적

중앙 작업영역을 GP8형 어두운 작업대와 밝은 악보 페이지로 만들고, 입력 포커스·스크롤·줌·표시 모드의 감각을 정돈한다.

### 복사해서 사용할 프롬프트

```text
[Phase 10: Score Workspace and Viewport Parity]

SVG 악보 레이아웃 엔진은 변경하지 않고, 그것을 담는 ScoreWorkspace/ScoreViewport의 배경, 페이지 배치, zoom, scroll, focus, overlay 동작을 리마스터하라.

먼저 읽을 파일:
- src/engine/render/SvgRenderer.tsx
- src/engine/layout/sceneGraph.ts
- src/engine/editing/overlays.ts
- 현재 ScoreWorkspace/scoreViewport CSS
- documentSettings.displayMode와 zoom 처리
- cursorFromHit/hitTest 경로

구현 요구사항:
1. `ScoreWorkspace`, `ScoreViewport`, `ScorePageFrame`, `WorkspaceOverlay`로 책임을 분리한다.
2. viewport는 toolbar/tab/panel 변화 후 남은 정확한 공간을 채우고 불필요한 바깥 card border/radius를 제거한다.
3. page는 workspace 중앙 또는 display mode 규칙에 맞춰 배치하며 종이 shadow는 작고 현실적으로 유지한다.
4. 다음 display mode를 명확히 구분한다.
   - vertical-page
   - horizontal-page
   - grid
   - parchment/continuous
   - vertical-screen
   - horizontal-screen
5. mode별 CSS만 바꾸고 score scene 데이터는 중복 생성하지 않는다.
6. Zoom 요구사항:
   - 25–300%, 5% step
   - Ctrl/Cmd +/-
   - Ctrl/Cmd+mouse wheel은 브라우저 zoom과 충돌 정책을 명시
   - zoom 전후 커서 또는 viewport center가 가능한 한 같은 화면 지점에 유지
   - fit width / fit page 옵션
7. active document마다 scroll position, zoom, display mode를 복원한다.
8. score를 클릭하면 workspace가 focus되고 keyboard note input이 작동한다.
9. 포커스 링은 전체 밝은 border가 아니라 subtle inset blue로 표시한다.
10. playback cursor가 viewport를 벗어나면 사용자 설정에 따라 최소 scroll로 따라간다. 사용자가 수동 스크롤 중이면 강제 점프하지 않는 grace period를 둔다.
11. click hit metadata는 기존 cursorFromHit 경로를 유지한다.
12. selection, editing cursor, playback cursor의 색과 z-order를 분리한다.
13. 빈 score, 한 페이지, 여러 페이지, 20트랙 score에서 layout shift가 없어야 한다.
14. 페이지 렌더가 많을 때 화면 밖 page virtualization 가능성을 측정하고, 필요하면 Phase 18용 수치를 남긴다. 이번 Phase에서 무리하게 엔진을 교체하지 않는다.

시각 목표:
- workspace background는 거의 검은 navy.
- 페이지 간 gap 16–24px.
- 페이지 바깥 padding은 1024에서 12px, 큰 화면에서 20px 내외.
- page radius 0–2px.
- scrollbar가 패널 경계와 조화를 이룬다.
- 커서/현재 마디 노란색과 선택 blue가 섞이지 않는다.

테스트:
- 각 display mode screenshot
- zoom anchor 유지
- 문서 전환 후 scroll/zoom 복원
- click→keyboard input
- playback auto-follow와 수동 scroll grace
- 1024×768에서 page가 패널 아래에 가려지지 않음

완료 조건:
- 악보 엔진 출력은 유지하면서 workspace 경험이 독립 컴포넌트로 정돈된다.
- zoom/display/scroll 상태가 문서별로 안정적이다.
- hit test와 keyboard editing 회귀가 없다.

권장 커밋:
- feat(workspace): remaster score viewport zoom scrolling and page modes
```

---

## Phase 11 — 우측 SONG/TRACK 인스펙터

### 목적

현재 Song과 Track 폼이 동시에 쌓이는 방식을 상단 탭 기반 고밀도 인스펙터로 교체한다.

### 복사해서 사용할 프롬프트

```text
[Phase 11: SONG and TRACK Inspector Dock]

우측 Inspector를 `SONG`과 `TRACK` 탭으로 분리하고 GP8형 속성 편집 흐름으로 재구성하라.

먼저 읽을 파일:
- 현재 InspectorPanel 구현 전체
- SongInfo/Track/StaffConfig/NotationType 타입
- mixer 관련 타입과 playbackStore
- specs/01-UI-구조와-내비게이션.md의 Inspector 부분
- track system panels와 중복되는 필드

구조:
- InspectorDock
  - InspectorTabs
  - SongInspector
  - TrackInspector
    - Identity section
    - Notation section
    - Tuning/Transposition section
    - Interpretation section
    - Sound section

구현 요구사항:
1. SONG과 TRACK은 동시에 세로로 렌더하지 않는다. activeInspectorTab은 layoutStore에 저장한다.
2. F5는 Inspector를 열고 SONG 탭 활성화, F6는 열고 TRACK 탭 활성화한다. 이미 활성 상태면 같은 키의 toggle 정책을 명시하고 일관되게 구현한다.
3. 상단 탭은 panel 폭 전체를 1:1로 나누고 active blue underline/fill을 사용한다.
4. form control을 공통 `InspectorField`, `InspectorSection`, `InspectorRow`로 만든다.
5. Song:
   - title, subtitle, artist, album, words, music 등
   - 긴 notice/instructions는 textarea 또는 확장 dialog
   - concert tone toggle
6. Track:
   - name, short name, color
   - notation type check/toggle
   - staff config
   - transposition
   - tuning summary와 edit action
   - track move/delete
   - interpretation action
   - sound/mixer controls
7. 즉시 반영 text input이 undo stack을 글자마다 오염시키지 않도록 transaction coalescing 또는 blur commit 정책을 설계한다.
8. 삭제는 확인 dialog와 최소 한 트랙 보존 규칙을 따른다.
9. field label, current value, unit, reset/default action을 정렬한다.
10. sound effect toggle은 icon+tooltip을 사용하며 active chain과 동기화한다.
11. panel 폭 192–320px에서 label과 input이 잘리지 않도록 1열/compact 2열 규칙을 정의한다.
12. Inspector와 TrackSystemPanels가 같은 설정을 중복 구현하지 않도록 shared editor form 또는 command를 사용한다.

시각 목표:
- tab strip 27–30px.
- section header 22–24px, separator 1px.
- input height 24–28px.
- label 11px muted, value 12px.
- color picker는 작은 swatch+hex/trigger 형태.
- 과도한 8px card를 사용하지 않고 flat sections로 구분.

테스트:
- F5/F6 tab behavior
- active track 전환 시 field 갱신
- title/name edit와 undo grouping
- track delete cancel/confirm
- notation/tuning/sound state 동기화
- 192/212/320px visual test

완료 조건:
- SONG/TRACK 탭이 완전 동작한다.
- 기존 Song/Track 편집 기능이 모두 새 패널에서 접근 가능하다.
- 한 입력이 불필요하게 수십 개 undo를 만들지 않는다.

권장 커밋:
- feat(inspector): split song and track properties into tabbed dock
```

---

## Phase 12 — 하단 Global View·믹서 리마스터

### 목적

트랙 목록, 믹서 상태, 마디 그리드, 현재 위치를 하나의 고밀도 글로벌 도크로 정렬한다.

### 복사해서 사용할 프롬프트

```text
[Phase 12: Global View and Mixer Dock Parity]

현재 GlobalView와 TrackMixerStrip을 GP8형 하단 트랙/마디 개요로 재구성하라. 오디오 엔진 로직은 바꾸지 않는다.

먼저 읽을 파일:
- 현재 GlobalView, TrackMixerStrip, AutomationEditor
- playbackStore mixer 타입과 action
- score.tracks/masterBars 구조
- cursor/global jump 처리
- specs/01 및 specs/04의 Global View/Mixer 부분

목표 레이아웃:
- 좌측 고정 track header column
  - master row
  - 각 track row: color, name, visibility, mute, solo, volume/pan compact controls
- 우측 horizontally scrollable measure grid
  - header bar numbers/sections
  - track×bar cells
  - current cursor, selection, playback position
- shared vertical scroll, shared row heights

구현 요구사항:
1. track header와 measure grid의 행 높이를 하나의 row metrics source에서 계산한다.
2. 좌측과 우측의 수직 스크롤이 절대 어긋나지 않게 동일 scroll container 또는 동기화 로직을 사용한다.
3. 우측 horizontal scroll만 grid에 적용하고 좌측 track header는 고정한다.
4. 각 bar cell은 track color를 사용하되 전체를 강한 색으로 채우지 말고 작은 indicator/soft fill을 사용한다.
5. 현재 cursor cell은 yellow outline, playback cell/line은 blue, selected range는 translucent fill로 구분한다.
6. cell click은 `onGlobalJump(trackId, barIndex)`의 기존 경로를 유지한다.
7. row click은 current track을 전환하고 workspace에서 같은 bar를 유지한다.
8. master row에는 master volume/focus 및 필요한 global controls를 제공한다.
9. volume/pan은 compact slider 또는 popover를 사용해 행 높이를 과도하게 키우지 않는다.
10. M/S/visibility/automation 버튼의 active/disabled 상태를 명확히 한다.
11. track 수가 많아도 60fps scroll을 목표로 한다. 셀 수가 큰 경우 CSS containment 또는 virtualization 측정값을 남긴다.
12. F8 toggle, splitter resize, size persistence를 유지한다.
13. 글로벌 뷰가 닫혀도 toolbar LCD/track popover로 트랙 이동이 가능해야 한다.
14. Automation Editor가 별도 도크인지 global dock 내부 tab인지 저장소 스펙과 현재 사용성을 비교해 결정하고 문서화한다. 기능을 숨기지 않는다.

시각 목표:
- default 166px 높이, row 25–30px.
- track header width 220–300px 범위.
- bar cell width 38–46px.
- grid line는 subtle slate, current cell만 강한 yellow.
- mixer 버튼 20–24px, label 11px.

테스트:
- 1/8/20트랙 visual 및 scroll
- track header/grid row alignment 측정
- current/playback/selection 상태
- M/S/visibility/volume/pan 동작
- F8와 persisted height
- 100마디 horizontal scroll

완료 조건:
- 글로벌 뷰의 좌우 행이 모든 viewport에서 맞는다.
- 기존 mixer action과 cursor jump가 유지된다.
- 과도한 세로 공간 없이 핵심 상태를 한눈에 볼 수 있다.

권장 커밋:
- feat(global-view): align compact mixer headers with measure overview grid
```

---

## Phase 13 — 오디오 트랙 파형 도크

### 목적

악보 타임라인과 공유되는 선택적 오디오 파형 도크를 추가해 GP8의 오디오 트랙 작업 흐름에 근접시킨다.

### 복사해서 사용할 프롬프트

```text
[Phase 13: Audio Track Waveform Dock]

먼저 저장소에 오디오 트랙 도메인 데이터가 실제로 어느 수준까지 있는지 감사하라. 없는 기능을 작동하는 척하지 말고, UI shell과 adapter를 단계적으로 구현하라.

먼저 읽을 파일:
- src/model/types.ts에서 audio 관련 검색
- src/engine/audio/**
- src/io/**의 audio import/export 관련 코드
- specs/04-오디오-엔진과-재생.md의 Audio Track 부분
- layoutStore, playbackStore, ScoreWorkspace, GlobalViewDock

첫 보고에 반드시 포함:
- 현재 지원: 오디오 파일 선택, decode, 재생, seek, waveform, offset, tempo sync 각각 yes/no/partial
- 기존 score format에 저장 가능한 데이터
- 이 Phase에서 안전하게 구현할 최소 범위

도메인 adapter 제안:
- `AudioTrackDescriptor`: id, fileName, durationSec, offsetSec, gain, mute, embedded/reference metadata
- `AudioWaveformPeaks`: channel peaks and resolution
- `AudioSyncState`: offset, scoreStartTick, playbackRate policy

구현 요구사항:
1. `AudioTrackDock`을 중앙 workspace와 global dock 사이에 배치하고 layoutStore로 표시/높이를 관리한다.
2. 실제 파일이 없을 때는 빈 상태와 Add audio action을 보여준다. 가짜 파형을 기본 제품 화면에 그리지 않는다.
3. 브라우저에서 허용되는 형식의 파일을 선택해 AudioContext decode 또는 HTML media adapter로 duration을 읽는다.
4. 파형 peaks 계산은 UI thread를 장시간 막지 않도록 worker/offline chunk 전략을 검토한다.
5. waveform canvas/SVG는 viewport 범위만 렌더하고 resize/zoom에 대응한다.
6. score timeline과 공유하는 x mapping utility를 만든다.
   - tick→second는 기존 playback compilation/tempo map 사용
   - second→x와 tick→x가 같은 ruler를 공유
7. cursor/playhead/loop range를 waveform 위에도 표시한다.
8. waveform click/drag seek는 playback controller의 단일 seek action을 호출한다.
9. 기본 controls: add/replace/remove, mute, gain, zoom, offset, lock/sync.
10. Audio button의 blue outline/selected 상태와 도크 가시성을 동기화한다.
11. 파일 저장 정책은 브라우저 한계를 명확히 구분한다.
   - metadata만 저장
   - File System handle reference
   - embedded binary가 가능한 native format
   중 현재 구현 가능한 방식을 문서화한다.
12. 큰 오디오 파일에서 object URL과 AudioBuffer cleanup을 수행한다.
13. 기능 미지원 브라우저에서는 명확한 안내와 fallback을 제공한다.

시각 목표:
- header 25–28px, waveform body 80–140px.
- dark navy background, waveform muted blue/gray.
- playhead bright blue, score cursor yellow, loop translucent blue.
- controls는 좌측 compact strip 또는 header에 배치.

테스트:
- fixture wav import
- decode failure/error message
- waveform deterministic peaks unit test
- click seek와 playhead update
- dock resize/persistence
- remove 시 resource cleanup
- no-audio/audio-loaded visual snapshots

완료 조건:
- 지원 수준이 문서화되고 UI가 허위 기능을 표시하지 않는다.
- 실제 오디오 파일에서 파형과 seek가 동작하거나, 도메인 범위가 부족하면 shell+adapter+명확한 disabled 상태까지 완성한다.
- score playback 기능에 회귀가 없다.

권장 커밋:
- feat(audio-track): add synchronized waveform dock and audio adapter
```

---

## Phase 14 — GP8형 Home 런처

### 목적

앱 시작과 홈 버튼에 New/Open/Search/Recent/Templates/Examples/Preview 중심의 런처를 제공한다.

### 복사해서 사용할 프롬프트

```text
[Phase 14: Home Launcher and File Library UX]

열린 문서를 유지한 채 Home 화면으로 돌아갈 수 있는 런처를 구현하라. mySongBook 상표/서비스는 복제하지 말고 일반적인 Library 또는 Online Catalog 자리로 추상화한다.

먼저 읽을 파일:
- specs/01-UI-구조와-내비게이션.md의 Homepage 전체
- useFileController
- documentStore
- native score serializer/parser
- AppShell의 Home toolbar action
- current persistence/localStorage/IndexedDB 사용 현황

라우팅/상태 정책:
1. `/home`과 `/editor` 또는 app-level screen state 중 열린 문서를 유지하기 쉬운 구조를 선택하고 이유를 문서화한다.
2. Home으로 이동해도 재생은 중지하되 문서 탭과 dirty 상태는 유지한다.
3. editor로 돌아올 때 scroll/cursor/panel 상태가 보존된다.

Home 구조:
- 상단 브랜드 영역: 프로젝트의 독립 이름/로고
- New File
- Open File
- 통합 Search
- category tabs: Recent, Local, Library/Catalog, Templates, Examples
- 좌측 file list 또는 card list
- 우측 score preview와 track preview controls

구현 요구사항:
1. Recent files:
   - title, lastOpened, location/source, pinned
   - pin은 상단 정렬
   - clear recent 전체 동작
2. Local files:
   - File System Access API가 있으면 directory picker와 handle persistence를 검토
   - 없으면 multi-file picker fallback
3. Templates:
   - 저장소의 score snapshot으로 제공
   - New From Template은 독립 문서를 생성
4. Examples:
   - 프로젝트가 저작권을 보유하거나 허용 라이선스인 예제만 사용
5. Search:
   - typing 시 debounce 100–200ms
   - category별 결과 수
   - title/artist/file name 중심
6. Preview:
   - 가능한 경우 native parser로 첫 페이지 축소 렌더
   - preview 때문에 활성 편집 문서를 교체하지 않음
   - track audio preview는 실제 지원 범위가 없으면 표시하지 않거나 disabled 이유 제공
7. loading/empty/error/permission denied 상태를 각각 설계한다.
8. Home button은 toolbar에서 항상 접근 가능하다.
9. Ctrl/Cmd+N, Ctrl/Cmd+O는 Home과 Editor에서 동일 controller action을 사용한다.
10. recent metadata는 versioned IndexedDB 또는 localStorage schema로 저장하고 손상 복구를 처리한다.
11. 공개 제품에서는 Guitar Pro/MySongBook 이름과 원본 예제 미디어를 사용하지 않는다.

시각 목표:
- full-screen dark slate.
- New/Open/Search가 상단 중앙에 명확히 배치.
- category tab strip은 compact blue selection.
- list는 좌측 약 38–44%, preview는 우측.
- score preview는 밝은 종이 썸네일.
- 앱 셸과 같은 토큰/아이콘 사용.

테스트:
- 앱 시작 Home 정책
- new/open→editor
- editor→home→editor 상태 보존
- recent pin/search/clear
- template 문서 독립성
- permission denied fallback
- 1024/1440/1920 Home visual tests

완료 조건:
- Home이 단순 모달이 아니라 완전한 런처 작업 흐름을 제공한다.
- 열려 있는 문서를 잃지 않는다.
- 독립 브랜딩과 허용된 콘텐츠만 사용한다.

권장 커밋:
- feat(home): add persistent launcher for recent local templates and previews
```

---

## Phase 15 — Command Palette·팝오버·오버레이 통합

### 목적

현재 2열 고정 좌표 Command Palette와 여러 absolute panel을 일관된 overlay 시스템으로 교체한다.

### 복사해서 사용할 프롬프트

```text
[Phase 15: Command Palette and Overlay System]

기존 command parsing 기능을 보존하면서 Command Palette의 위치·밀도·키보드 동작을 GP8형 단일 컬럼 패널로 리마스터하고 overlay layering을 통합하라.

먼저 읽을 파일:
- src/ui/shell/CommandPalette.tsx
- src/commands/paletteCommands.ts 전체
- useCommandController
- StylesheetPanel, FileIoPanel, ToolPanels, TrackSystemPanels
- 현재 overlays.css의 fixed/absolute 좌표

Overlay architecture:
1. overlay 종류를 구분한다.
   - anchored popover/menu
   - non-modal floating tool window
   - modal dialog
   - command palette
2. z-index, Portal root, Escape 우선순위, outside click, focus restore를 하나의 정책으로 만든다.
3. 여러 boolean 대신 `overlayStore`의 stack 또는 typed active overlay를 사용한다. 동시에 열릴 수 있는 조합을 명시한다.

Command Palette 요구사항:
1. editor 상단 중앙, tab bar 바로 아래에 뜨는 단일 컬럼 패널.
2. 폭은 viewport에 따라 520–760px, 1024에서는 좌우 최소 24px.
3. 입력 row와 결과 list를 분리한다.
4. 결과 row:
   - prefix/command
   - description
   - shortcut 또는 category
   - disabled reason
5. Up/Down/PageUp/PageDown/Home/End, Enter, Escape, Tab completion.
6. 검색은 prefix, label, alias, description을 대상으로 deterministic ranking.
7. quick/action/expression/section/bar mode의 현재 parser를 유지하고 mode badge를 보여준다.
8. command history를 저장하고 위/아래로 탐색한다.
9. 선택된 결과만 blue row, hover와 keyboard selection을 일치시킨다.
10. 결과가 많아도 virtualize 또는 제한+scroll하여 입력 지연이 없어야 한다.
11. 실행 후 닫힘/keepOpen 정책은 command result에 따른다.
12. focus는 열 때 input, 닫을 때 원래 workspace/trigger로 복원한다.

기타 overlay 요구사항:
- anchored popover는 trigger 기준 collision 처리.
- modal은 focus trap과 inert background.
- tool window는 viewport 밖으로 나가지 않으며 drag/resize 지원 여부를 명시.
- hidden overlay가 DOM tab order에 남지 않음.
- Escape는 가장 위 overlay 하나만 닫음.

시각 목표:
- Command Palette background #20232c 계열, 1px slate border, shadow.
- 입력 32–36px, 결과 row 30–34px.
- 2열 카드 목록 금지; 한 줄 또는 밀도 높은 두 칼럼 내부 grid.
- top 위치는 셸 토큰으로 계산하고 `left:226px; right:300px` 같은 패널 의존 좌표 금지.

테스트:
- 모든 mode parser 회귀
- ranking/history/keyboard navigation
- focus restore와 nested overlay Escape
- 1024/1440 visual
- panel visibility가 달라도 palette 중앙 정렬
- screen reader label

완료 조건:
- Command Palette가 단일 컬럼 전문 도구 형태다.
- 고정 left/right absolute 좌표 의존이 사라진다.
- overlay focus와 Escape 정책이 통합된다.

권장 커밋:
- feat(overlays): unify command palette popovers dialogs and focus policy
```

---

## Phase 16 — Tool/Track/Stylesheet/File 패널 창 처리

### 목적

기존 거대한 absolute overlay들을 역할에 맞는 다이얼로그·플로팅 도구창·도킹 패널로 재분류한다.

### 복사해서 사용할 프롬프트

```text
[Phase 16: Remaster Tool Windows and Dialogs]

현재 `ToolPanels.tsx`, `TrackSystemPanels.tsx`, `StylesheetPanel.tsx`, `FileIoPanel.tsx`를 감사하고 각 UI를 modal dialog, non-modal tool window, popover, dock 중 올바른 형태로 전환하라.

먼저 읽을 파일:
- 위 네 패널 파일 전체
- overlayStore와 design-system Dialog/Popover
- 각 패널이 호출하는 domain function
- specs/01, 05, 06 관련 부분

먼저 분류표를 작성한다. 권장 시작점:
- Add Track Wizard: modal dialog
- Tuning: modal 또는 anchored inspector dialog
- Voices/Interpretation: modal/tool dialog
- Drum Kit: non-modal tool window
- Chords/Scales/Instrument view/Tuner: non-modal tool window
- Transpose/Cleanup: modal dialog
- Stylesheet: large modal 또는 dockable tool window
- File I/O: File menu와 native browser flow 중심, 필요 시 modal hub
- Preferences: modal dialog

공통 ToolWindow 요구사항:
1. titlebar, icon, title, close.
2. optional minimize/dock/always-on-top는 실제 동작할 때만 표시.
3. drag는 titlebar에서만 시작하고 viewport 경계 안에 clamp.
4. resize handle과 최소/최대 크기.
5. 마지막 위치/크기는 layoutStore에 window id별 저장.
6. non-modal window는 score editing을 완전히 막지 않으며 focus order를 관리.
7. active window의 z-order가 앞에 오지만 무한 증가하지 않도록 stack index를 정규화.

Modal 요구사항:
- title/description 제공
- primary/secondary/danger action의 위치 일관
- Enter submit, Escape cancel
- unsaved edit가 있으면 닫기 정책
- background inert/focus trap

각 도구별 요구사항:
1. Add Track Wizard는 instrument category→instrument→notation/tuning→create의 단계와 summary를 제공.
2. Tuning은 preset, 각 string pitch, capo, keep fingering/adjust fingering을 명확히 분리.
3. Chord/Scale/Instrument tool은 score selection과 실시간 동기화하되 controller를 통해 변경.
4. Tuner/Line-in은 microphone permission 상태를 정확히 보여준다.
5. Stylesheet는 category tabs와 preview/apply/reset; typing마다 전체 undo를 만들지 않음.
6. File I/O는 브라우저 picker를 우선하고, 지원하지 않는 format을 활성 버튼으로 위장하지 않음.
7. Preferences는 General/Interface/Score Errors/User Information 등 실제 구현된 항목만 노출하고 미구현은 명확히 표시.

시각 목표:
- header 28–32px.
- tool window는 flat dark slate, border 1px, radius 3–5px.
- modal max-width와 max-height는 viewport 기반.
- form controls는 Inspector와 같은 design-system 사용.
- tool windows가 좌우 panel fixed 좌표에 종속되지 않음.

테스트:
- drag/resize/persistence
- modal focus trap/submit/cancel
- score editing과 non-modal tool 병행
- permission/error 상태
- 각 tool의 기존 핵심 action 회귀
- 1024 viewport boundary clamp

완료 조건:
- 이전 `top:92px; left:...; right:...` 유형 고정 overlay가 제거된다.
- 도구별로 올바른 modal/non-modal 동작을 가진다.
- 기존 도메인 기능이 새 UI에서 작동한다.

권장 커밋:
- feat(tool-windows): replace fixed panels with dockable tools and dialogs
```

---

## Phase 17 — 키보드·포커스·접근성 완성

### 목적

전문 데스크톱 편집기처럼 마우스 없이 메뉴·패널·악보·도구창을 사용할 수 있게 하고, 전역 단축키 충돌을 정리한다.

### 복사해서 사용할 프롬프트

```text
[Phase 17: Keyboard, Focus and Accessibility Pass]

기존 keymap과 새 UI primitive를 기반으로 전체 앱의 keyboard/focus/a11y 계약을 완성하라.

먼저 읽을 파일:
- src/commands/keymap.ts 및 테스트
- 모든 window.addEventListener('keydown') 위치
- design-system primitives
- AppShell, Menubar, Toolbar, Tabs, Palette, Inspector, Workspace, overlays
- specs/06-도구와-부가기능.md의 단축키 표

구현 요구사항:
1. 전역 keydown listener를 검색해 우선순위와 scope를 표로 만든다.
2. scope를 명시한다.
   - global
   - workspace
   - menu
   - dialog
   - command palette
   - text input
3. text input/contentEditable에서 음악 입력 단축키가 발동하지 않게 한다. 단 Save/Escape 같은 허용 글로벌 키는 정책적으로 처리한다.
4. overlay가 열려 있을 때 background workspace shortcut를 차단한다.
5. 메뉴, tabs, palette grid, toolbar, inspector tabs에 roving tabindex를 구현한다.
6. workspace로 돌아가는 명시적 shortcut 또는 Escape chain을 제공한다.
7. F2/F5/F6/F8/F10이 panel visibility와 focus를 예측 가능하게 바꾼다.
8. focus-visible ring은 keyboard에서만 선명하고 pointer click에서는 과도하게 남지 않는다.
9. icon button, splitter, slider, waveform, score viewport에 accessible name/value를 제공한다.
10. color만으로 active/error/selection을 전달하지 않는다.
11. live playback time은 지나치게 빈번한 screen reader announcement를 하지 않는다.
12. modal/tool window title relationship과 focus restore를 검사한다.
13. axe-core 또는 Playwright 접근성 검사 도구를 도입해 critical/serious 위반을 실패 처리한다.
14. reduced motion, high contrast/forced colors에서 핵심 상태가 보이는지 확인한다.
15. shortcuts help overlay를 MENU_TREE/KEYMAP_ENTRIES에서 자동 생성할 수 있게 한다.

키보드 시나리오 테스트:
- 앱 시작→New→score 입력→Undo→Save를 keyboard-only로 수행
- Alt 또는 click으로 Menu 진입→submenu 실행→workspace 복귀
- F2→palette grid 이동→effect 적용→workspace 복귀
- F6→Track inspector→field edit→Escape
- Ctrl/Cmd+E→command 실행
- Ctrl+Tab 문서 이동
- dialog 열기→Tab cycle→Cancel/Confirm
- splitter keyboard resize

완료 조건:
- critical/serious accessibility violation 0.
- 전역 key listener 우선순위가 문서화된다.
- 텍스트 입력 중 음표/효과가 오작동하지 않는다.
- 모든 주요 흐름을 keyboard-only E2E가 통과한다.

권장 커밋:
- fix(a11y): unify keyboard scopes focus restoration and accessible states
```

---

## Phase 18 — 반응형 오버플로·고해상도·성능

### 목적

1024부터 4K까지 전문 도구의 밀도와 기능 접근성을 유지하고, 큰 악보에서 UI 리마스터가 성능을 악화시키지 않게 한다.

### 복사해서 사용할 프롬프트

```text
[Phase 18: Responsive Density, HiDPI and Performance]

최종 시각 polish 전에 viewport/scale/performance 행렬을 검증하고 병목을 계측하여 수정하라.

먼저 읽을 파일:
- AppShell과 모든 dock CSS
- TopToolbar overflow logic
- ScoreWorkspace/SvgRenderer
- GlobalView measure grid
- waveform implementation
- React profiler 또는 현재 memoization
- Phase 0/1/후속 visual tests

검수 행렬:
- 1024×768, DPR 1
- 1280×768, DPR 1
- 1440×900, DPR 1
- 1920×1080, DPR 1
- 2560×1440, DPR 2 simulated
- browser zoom 80%, 100%, 125%

구현 요구사항:
1. 각 viewport에서 toolbar overflow, panel min/max, dock height, menu collision, dialog clamp를 검사한다.
2. 1024에서 기능을 숨기기만 하지 말고 overflow/menu 경로를 보장한다.
3. 1920 이상에서 컨트롤을 불필요하게 늘리지 않고 workspace가 확장되게 한다.
4. SVG icon과 1px border가 DPR에서 흐려지지 않도록 좌표/크기를 확인한다.
5. Canvas waveform은 devicePixelRatio에 맞춰 backing store를 조정한다.
6. Score zoom과 browser DPR가 겹쳐 text가 흐려지지 않는지 검사한다.
7. 다음 성능 fixture를 만든다.
   - 1트랙 32마디
   - 8트랙 100마디
   - 20트랙 300마디
8. 측정:
   - 초기 렌더 시간
   - cursor 이동 commit 시간
   - panel resize 중 FPS
   - global grid scroll FPS
   - memory growth
9. 불필요한 store 전체 구독을 selector 단위로 줄인다.
10. controller return object와 callbacks의 불필요한 재생성을 줄인다.
11. global grid가 병목이면 windowing/virtualization을 도입하되 keyboard navigation과 cell semantics를 보존한다.
12. score renderer는 별도 근거 없이 대규모 재작성하지 않는다. scene memoization/viewport page mount를 우선한다.
13. resize 중 무거운 layoutScore 재계산을 frame-throttle하거나 drag 종료 시 정밀 계산하는 전략을 검토한다.
14. 번들 분석으로 새 UI 의존성의 비용을 기록하고 icon barrel 전체 import를 제거한다.
15. Lighthouse 점수 자체보다 실제 editor interaction latency를 우선한다.

성능 예산 시작값:
- 일반 cursor 이동 React commit: 목표 16ms 이하, 최대 32ms
- panel resize: 체감 50–60fps
- menu/popover open: 100ms 이내
- 8트랙 100마디 초기 interactive: 개발 환경 기준 측정값과 개선 전후를 문서화

완료 조건:
- 모든 viewport에서 겹침/잘림 없음.
- overflow 기능 접근 가능.
- 성능 fixture와 전후 측정표가 존재.
- UI 리마스터로 인한 명백한 입력 지연이 없다.

권장 커밋:
- perf(ui): stabilize responsive shell and large-score interactions
```

---

## Phase 19 — 최종 시각 근접성 감사와 정리

### 목적

참조 화면과 동일 viewport에서 구조·치수·색·상태·상호작용을 비교하고, 임시 코드와 legacy CSS를 제거해 리마스터를 마감한다.

### 복사해서 사용할 프롬프트

```text
[Phase 19: Final Visual Parity Audit and Cleanup]

이 Phase는 새 기능 개발이 아니라 최종 비교·교정·정리다. 합법적으로 확보한 사용자 보유 Guitar Pro 8 참조 스크린샷과 현재 앱을 같은 viewport로 비교하라.

먼저 읽을 자료:
- docs/ui-remaster 전체
- reference-ui/의 로컬 참조 이미지 목록과 viewport metadata
- 모든 visual golden diff
- design token 파일
- component map과 remaining-debt 문서

필수 참조 장면:
1. 기본 editor: palette+track inspector+global view
2. palette hidden
3. song inspector
4. playback active+loop
5. command palette
6. add track/tuning/tool window
7. stylesheet/preferences dialog
8. home launcher
9. audio waveform dock loaded state
10. 최소 1024 viewport overflow 상태

비교 절차:
1. 각 장면을 동일 viewport, 100% browser zoom, 동일 panel state로 캡처한다.
2. 50% opacity overlay와 difference image를 로컬에서 생성한다.
3. 다음 앵커를 숫자로 비교한다.
   - 메뉴/툴바/탭 높이
   - panel 폭과 dock 높이
   - LCD 위치/크기
   - page 첫 x/y와 workspace padding
   - icon button 크기와 group 간격
   - palette cell, inspector row, global row/bar cell
   - command palette 위치/폭/row height
4. 차이를 `must match`, `acceptable adaptation`, `intentional divergence`, `blocked by web platform`으로 분류한다.
5. must match 항목을 token/컴포넌트 수준에서 수정한다. 화면별 selector patch를 남발하지 않는다.
6. 색은 reference sampling 값을 그대로 제품 고유 자산처럼 복사하지 말고, 전체 톤과 대비를 맞추는 semantic token으로 교정한다.
7. 독립 브랜딩, 아이콘, browser-native file picker 차이는 intentional divergence로 문서화한다.
8. 상태별 시각 검수:
   - default/hover/pressed/selected/focus/disabled/error
9. 모든 legacy class, unused CSS, duplicate toolbar group, dead placeholder, 임시 test data를 제거한다.
10. console log, TODO, `any`, ignored TypeScript/ESLint 경고를 검사한다.
11. README에 리마스터 구조, shortcut, 테스트, 참조 에셋 정책을 추가한다.
12. 최종 QA 문서를 만든다.

최종 테스트:
- pnpm test
- pnpm build
- pnpm test:e2e
- pnpm test:visual
- 접근성 검사
- 네 viewport와 핵심 장면 screenshot
- 새로고침/persistence
- 다중 문서/dirty close
- edit/playback/import/export smoke

최종 산출물:
- docs/ui-remaster/19-final-parity-report.md
- docs/ui-remaster/19-anchor-measurements.csv
- docs/ui-remaster/19-intentional-differences.md
- 최종 Playwright golden
- README 업데이트

완료 조건:
- must match 차이가 0개이거나 명확한 기술적 blocker와 증거가 있다.
- 기능 회귀가 0개다.
- 원본 브랜드/아이콘/미디어가 코드나 번들에 포함되지 않는다.
- 남은 차이는 공개 가능한 intentional difference 문서에 기록된다.

권장 커밋:
- chore(ui-remaster): finalize visual parity audit and remove legacy shell
```

---

# 8. 선택 Phase 20 — 태블릿용 재배치

이 Phase는 Guitar Pro 8 데스크톱 UI와의 동일성을 달성한 뒤에만 진행한다. 데스크톱 화면을 무리하게 축소하는 것이 아니라, 모바일 DAW 프로젝트에 맞춰 동일 커맨드와 상태를 다른 배치로 투영한다.

### 복사해서 사용할 프롬프트

```text
[Optional Phase 20: Tablet Adaptation Without Forking Domain Logic]

데스크톱 셸을 유지하면서 768–1024px touch viewport에 별도의 layout preset을 추가하라. command, document, playback, selection state는 공유하고 UI만 재배치한다.

요구사항:
1. breakpoint가 아니라 input modality와 available size를 함께 감지한다.
2. 좌측 palette와 우측 inspector는 edge sheet/drawer로 전환한다.
3. bottom global view는 draggable bottom sheet 또는 compact track lane으로 전환한다.
4. toolbar는 핵심 transport/LCD만 고정하고 나머지는 overflow sheet.
5. touch target은 최소 40–44px로 확대하지만 desktop density token은 유지한다.
6. score pinch zoom, two-finger pan, long-press context menu를 설계한다.
7. on-screen fret input pad는 기존 command dispatcher를 사용한다.
8. desktop CSS를 media query로 덮어쓰는 거대한 예외집합 대신 `layoutPreset: desktop | tablet` 컴포넌트 조합을 사용한다.
9. tablet 변경이 desktop Playwright golden을 바꾸지 않아야 한다.
10. iPad Safari와 Android Chrome에서 File System/AudioContext 제약을 문서화하고 fallback을 제공한다.

완료 조건:
- 데스크톱 기능과 상태가 태블릿 레이아웃에서도 같은 command id로 작동한다.
- touch 조작으로 최소 리프 입력→재생→수정→저장이 가능하다.
- desktop visual parity에 회귀가 없다.

권장 커밋:
- feat(tablet): add touch-first shell preset over shared editor commands
```

---

# 9. 단계 종료 검증 프롬프트

각 Phase 구현 후 별도 메시지로 아래를 붙여 넣어 자가 검증을 강제한다.

```text
방금 구현한 Phase를 완료했다고 가정하지 말고 감사하라.

1. Phase의 완료 조건을 원문 순서대로 다시 나열한다.
2. 각 조건에 대해 코드 파일, 테스트 이름, 실행 결과, 스크린샷 또는 DOM 측정값으로 증명한다.
3. 증거가 없는 조건은 미완료로 표시하고 지금 수정한다.
4. `pnpm test`, `pnpm build`, 관련 Playwright 테스트를 다시 실행한다.
5. browser console error와 React warning이 없는지 확인한다.
6. 변경 전 기능 중 사라진 진입점이 없는지 command/menu/toolbar/palette/keymap을 대조한다.
7. screenshot을 1024×768과 1440×900에서 확인한다.
8. snapshot update를 했다면 각 diff의 의도와 승인 근거를 설명한다.
9. 마지막에 PASS/FAIL 표와 정확한 git diff 요약을 출력한다.

FAIL이 하나라도 있으면 완료라고 말하지 말고 수정 후 재검증하라.
```

---

# 10. 시각 차이 교정 전용 프롬프트

기능은 맞지만 화면이 어색할 때 아래 프롬프트를 사용한다.

```text
현재 기능 코드는 유지하고 시각 근접성만 교정하라.

입력 자료:
- 참조 스크린샷 viewport와 앱 스크린샷 viewport는 동일하다.
- reference는 측정용이며 제품 에셋으로 사용하지 않는다.

작업 순서:
1. 두 화면에서 12개 이상의 시각 앵커를 측정해 표로 만든다.
2. 차이를 geometry, typography, color, spacing, icon, state, layering으로 분류한다.
3. 가장 큰 구조 차이부터 수정한다. 색 미세조정으로 구조 오차를 숨기지 않는다.
4. 수정은 semantic token 또는 공통 컴포넌트에 적용한다. 특정 screenshot만 맞추는 nth-child/절대좌표 패치는 금지한다.
5. 1024×768과 1440×900 모두에서 확인한다.
6. default뿐 아니라 hover, selected, focus, disabled도 캡처한다.
7. 변경 후 우리 앱 golden과의 diff를 검토하고 의도적 변경만 승인한다.
8. 원본 아이콘 경로나 이미지를 추출하지 않는다.

출력:
- 측정 전/후 표
- 수정한 token/component
- 남은 차이와 이유
- 테스트 결과
```

---

# 11. 회귀 발생 시 복구 프롬프트

```text
UI 리마스터 이후 기존 기능 회귀가 발생했다. 새 기능을 더 만들지 말고 원인을 격리하라.

1. 실패를 가장 작은 재현 단계와 자동 테스트로 먼저 고정한다.
2. 변경된 UI component→controller→command registry→store→engine 호출 경로를 추적한다.
3. 이전 구현과 현재 구현의 command id, context predicate, payload, transaction boundary를 비교한다.
4. 음악 engine을 수정하기 전에 UI adapter와 state ownership 오류를 우선 의심한다.
5. React stale closure, duplicated local state, wrong active document, focus scope, event preventDefault를 검사한다.
6. 최소 수정으로 고치고 regression test를 추가한다.
7. visual snapshot 갱신으로 기능 실패를 숨기지 않는다.
8. 수정 후 전체 unit/build/관련 E2E를 실행한다.

보고에는 root cause, 영향 범위, 수정 파일, 방지 테스트를 포함하라.
```

---

# 12. 최종 완료 기준표

| 카테고리 | 완료 기준 |
|---|---|
| 셸 | 메뉴·툴바·탭·좌/중/우·오디오·글로벌 도크가 목표 계층으로 정렬 |
| 레이아웃 | 좌우/하단 패널 리사이즈, 숨김, 크기 영속화, 1024 최소폭 대응 |
| 메뉴 | 모든 메뉴가 keyboard 탐색 가능하고 shared command/action 실행 |
| 툴바 | 아이콘 중심, responsive overflow, transport/LCD/loop/speed 동작 |
| 문서 | 다중 탭, 독립 dirty/undo, 저장/닫기 확인, keyboard cycling |
| 팔레트 | contextual icon grid, selected/disabled 상태, command 단일화 |
| 워크스페이스 | display mode, zoom anchor, scroll 복원, cursor/playback overlay |
| 인스펙터 | SONG/TRACK 탭, 속성 편집, sound/tuning/notation 진입점 |
| 글로벌 뷰 | track header와 measure grid 행 일치, mixer/cursor/playback 동기화 |
| 오디오 | 실제 지원 범위의 파형/seek/offset 또는 정직한 disabled shell |
| 홈 | New/Open/Search/Recent/Templates/Examples/Preview, 문서 상태 보존 |
| 오버레이 | Portal, focus trap/restore, Escape stack, viewport collision |
| 도구창 | 역할별 modal/non-modal 구분, drag/resize/persistence |
| 접근성 | critical/serious 위반 0, keyboard-only 핵심 workflow 통과 |
| 성능 | 큰 악보에서 입력/스크롤/resize가 체감 지연 없이 동작 |
| 테스트 | unit/build/E2E/visual/a11y 모두 통과 |
| 지식재산 | 원본 로고·아이콘·폰트·사운드·예제 콘텐츠가 번들에 없음 |
| 문서 | 구조, 토큰, 상태 소유권, 의도적 차이, QA 결과가 기록됨 |

---

# 13. 권장 참조 캡처 목록

사용자가 정당하게 접근 가능한 Guitar Pro 8 설치본에서 다음 화면을 같은 viewport로 캡처한다. 공개 저장소에는 올리지 않는다.

```text
reference-ui/
  1280x768/
    01-editor-default.png
    02-editor-song-inspector.png
    03-editor-palette-hidden.png
    04-playback-loop.png
    05-command-palette.png
    06-add-track.png
    07-tuning.png
    08-stylesheet.png
    09-audio-track.png
    10-home.png
  1440x900/
    ...
  metadata.json
```

`metadata.json` 예시:

```json
{
  "appVersion": "8.x",
  "os": "Windows or macOS",
  "displayScale": 1,
  "browserTarget": "Chromium",
  "viewports": {
    "1280x768": { "zoom": 1 },
    "1440x900": { "zoom": 1 }
  },
  "notes": "Reference screenshots are local-only and not distributable assets."
}
```

`.gitignore`에 다음을 추가한다.

```gitignore
reference-ui/
visual-overlays/
```

---

# 14. 저장소별 예상 수정 우선순위

| 우선순위 | 현재 파일 | 처리 방식 |
|---:|---|---|
| 1 | `src/App.tsx` | controller 추출 후 조립 컴포넌트로 축소 |
| 2 | `src/ui/shell/EditorShell.tsx` | shell·toolbar·tabs·palette·inspector·global로 분리 |
| 3 | `src/App.css` | 토큰/레이어/영역별 CSS로 분리 후 제거 |
| 4 | `src/store/preferencesStore.ts` | 사용자 설정만 유지, 레이아웃은 `layoutStore`로 이동 |
| 5 | `src/store/documentStore.ts` | 문서별 score/dirty/undo를 가진 다중 세션 구조 |
| 6 | `src/commands/paletteCommands.ts` | 메뉴 메타데이터 보강, UI 단일 소스 유지 |
| 7 | `src/ui/shell/CommandPalette.tsx` | overlay system과 단일 컬럼 결과로 재구성 |
| 8 | `ToolPanels.tsx` 등 | modal/tool window로 분류·분해 |
| 9 | `SvgRenderer.tsx` | DOM 계약/접근성/페이지 wrapper만 조정, 엔진 보존 |
| 10 | tests | Playwright·a11y·visual fixture 추가 |

---

# 15. 하지 말아야 할 바이브코딩 패턴

1. `App.tsx`를 읽지 않고 새 UI를 통째로 덮어쓰기.
2. 기능을 맞추기 어렵다는 이유로 버튼을 `disabled` 처리하고 완료 선언.
3. screenshot을 background image로 깔아 시각적으로만 비슷하게 만들기.
4. 원본 앱 아이콘을 캡처·크롭·trace해 번들링.
5. 메뉴·툴바·단축키마다 같은 동작을 별도 함수로 구현.
6. 좌우 패널 위치를 `left: 220px; right: 280px`처럼 다시 하드코딩.
7. 전역 `z-index: 99999`로 overlay 충돌을 덮기.
8. 모든 상태를 하나의 새 Zustand store에 합치기.
9. React state를 맞추기 위해 score 객체를 UI에서 직접 mutate.
10. 실패한 visual test를 근거 없이 `--update-snapshots`로 통과시키기.
11. CSS의 `nth-child`, viewport별 픽셀 patch를 계속 추가해 우연히 한 화면만 맞추기.
12. 모바일 반응형을 이유로 데스크톱 전문 도구의 정보 밀도를 먼저 훼손하기.
13. 한 Phase에서 리팩터링·신기능·색상 교체·테스트 삭제를 모두 섞기.
14. “비슷해 보인다”는 말만 하고 viewport·앵커·상태별 증거를 남기지 않기.

---

# 16. 권장 전체 커밋 흐름

```text
docs(ui-remaster): capture pre-remaster baseline
test(ui): add deterministic Playwright visual regression harness
refactor(app): extract editor playback file and command controllers
refactor(ui): split global stylesheet into tokenized layers
feat(ui): add accessible desktop editor primitives and icon system
feat(shell): add resizable persistent GP8-style editor dock layout
feat(menu): connect accessible desktop menus to shared command registry
feat(toolbar): remaster transport LCD and responsive command groups
feat(documents): implement independent multi-document editor tabs
feat(palette): rebuild edition palette as contextual command grid
feat(workspace): remaster score viewport zoom scrolling and page modes
feat(inspector): split song and track properties into tabbed dock
feat(global-view): align compact mixer headers with measure overview grid
feat(audio-track): add synchronized waveform dock and audio adapter
feat(home): add persistent launcher for recent local templates and previews
feat(overlays): unify command palette popovers dialogs and focus policy
feat(tool-windows): replace fixed panels with dockable tools and dialogs
fix(a11y): unify keyboard scopes focus restoration and accessible states
perf(ui): stabilize responsive shell and large-score interactions
chore(ui-remaster): finalize visual parity audit and remove legacy shell
```

각 커밋은 독립적으로 build/test가 통과해야 한다. 중간 커밋에서 앱이 깨지는 rebase 전제 작업은 피한다.

---

# 17. 참조 자료

- 프로젝트 저장소: `https://github.com/kimyounggaur/Guitarpro8_Copy_Web_App`
- 프로젝트 내부 UI 명세: `specs/01-UI-구조와-내비게이션.md`
- 프로젝트 내부 편집 명세: `specs/02-악보-데이터모델과-편집.md`
- 프로젝트 내부 기보 명세: `specs/03-기보법-심볼과-이펙트.md`
- 프로젝트 내부 오디오 명세: `specs/04-오디오-엔진과-재생.md`
- 프로젝트 내부 파일 명세: `specs/05-파일-임포트-익스포트.md`
- 프로젝트 내부 도구 명세: `specs/06-도구와-부가기능.md`
- Guitar Pro 공식 기능 개요: `https://www.guitar-pro.com/c/14-guitar-pro-features`
- Playwright Visual Comparisons: `https://playwright.dev/docs/test-snapshots`
- Radix Primitives 또는 동등한 접근성 primitive 문서
- `react-resizable-panels` 또는 직접 구현 Pointer Events splitter 검토 자료
- Lucide React 또는 허용 라이선스의 독립 아이콘 라이브러리

---

## 최종 실행 원칙

이 리마스터의 성공 기준은 “스크린샷 한 장이 비슷해 보이는 것”이 아니다. **사용자가 악보를 열고, 패널을 전환하고, 음표와 효과를 입력하고, 재생하고, 트랙을 조정하고, 저장하는 전체 흐름이 Guitar Pro 8 수준의 화면 밀도와 예측 가능한 상호작용으로 이어지는 것**이다.

따라서 항상 다음 우선순위를 지킨다.

```text
기능 보존 → 상태 소유권 정리 → 셸 기하 → 상호작용 → 접근성 → 시각 미세조정
```

시각을 먼저 덮어씌우지 말고, 동일한 기능 경로를 안정적으로 만든 뒤 토큰과 측정값으로 교정한다.
