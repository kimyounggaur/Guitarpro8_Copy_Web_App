# Phase 0 — Component Map & Regression Risk (App.tsx / EditorShell.tsx)

전체 소스를 읽고 수집한 책임 분리 표, 상태 소유권 지도, 커맨드 실행 경로, CSS 인벤토리, 회귀 위험 목록이다. 모든 항목은 file:line 근거를 포함한다. 이 문서는 이후 Phase 2(App.tsx 컨트롤러 분리), Phase 3(CSS 토큰화), Phase 5(셸 기하), Phase 6(메뉴), Phase 15/16(overlay)의 1차 입력 자료로 사용한다.

## 1. 컴포넌트/함수 책임 표

### `src/App.tsx` (2544줄 — 단일 컴포넌트 함수 `App()`, 94~2133줄 + 모듈 레벨 헬퍼 2135~2541줄)

| 영역 (file:line) | 책임 |
|---|---|
| `App.tsx:1-93` | Import(60+ 모듈 — engine/io/model/stores/ui) + 로컬 타입 `BrowserFileHandle`, `BrowserFilePickerWindow`, `PendingFileLoad` |
| `App.tsx:95-96` | 커맨드 레지스트리 부트스트랩(`ensureDemoCommandsRegistered()`, `ensureEditingCommandsRegistered()`) — 매 렌더마다 실행(내부적으로 `getCommand` 체크로 가드) |
| `App.tsx:98-107` | `documentStore` 구독: `score`, `dirty`, `documents`, `activeId`, `undoCount`, `redoCount`, `loadScore`, `transact`, `undo`, `redo` |
| `App.tsx:108-111` | `viewStore` 구독: `cursor`, `selection`, `setCursor`, `setSelection` |
| `App.tsx:112-130` | `playbackStore` 구독: 상태/포지션/루프/메트로놈/count-in/속도/믹서 + setter 6개 |
| `App.tsx:131-133` | `preferencesStore` 구독: `invertPlusMinus`, `panelVisibility`, `togglePanel` |
| `App.tsx:134-143` | **로컬 컴포넌트 state**(어떤 store에도 없음): `activeToolPanel`, `activeTrackPanel`, `stylesheetPanelOpen`, `fileIoPanelOpen`, `fileIoStatus`, `commandPaletteOpen`, `commandPaletteInitialValue`, `multiVoiceEdit`, `multiTrackView` |
| `App.tsx:144-150` | Ref: fret-input 버퍼, clipboard, `PlaybackScheduler`, 숨김 `<input type=file>`, pending-file-load descriptor, native file handle |
| `App.tsx:152-157` | Effect: 문서가 비어있으면 demo score를 `documentStore`+`viewStore`에 부트스트랩(스토어 간 side effect) |
| `App.tsx:159-165` | Effect: unmount 시 scheduler 정리, `playbackStore` 믹서를 `score.tracks`에 동기화 |
| `App.tsx:167-210` | 파생 데이터 memo: `playbackCompilation`(오디오 엔진), `scoreForLayout`(단일/다중 트랙 선택), `baseScene`/`scene`(레이아웃 + 커서/선택/재생 오버레이) |
| `App.tsx:212-231` | **전역 keydown 리스너 #1** — F2/F5/F6/F8/F10 패널 토글, `togglePanel`을 직접 호출하며 커맨드 레지스트리를 완전히 우회 |
| `App.tsx:233-379` | **전역 keydown 리스너 #2(capture phase, 147줄)** — 약 20개 이상의 추가 단축키(Command Palette 열기, Ctrl+N/O/S/Shift+S, F7, Ctrl+±/=, Escape로 모든 오버레이 닫기, Ctrl+Shift+Insert, F3, Ctrl+M, Ctrl+1-4, Alt+1-4, "A", Shift+S, Ctrl+F6, F4)를 컴포넌트 핸들러 직접 호출로 처리 — 이것도 커맨드 레지스트리를 완전히 우회 |
| `App.tsx:381-559` | `editorContext` memo — `EditorCommandContext` 전체 구현(커서 이동/노트·duration·effect 편집/재생 트랜스포트/클립보드/undo-redo 등 30개 이상 메서드), `commands/editingCommands.ts`의 커맨드 `execute()`가 소비 |
| `App.tsx:561-568` | `dispatchEditorCommand`, `openCommandPalette` |
| `App.tsx:570-818` | **파일 I/O 서브시스템** — 신규/열기/저장/다른이름저장 native `.gp`, import/export 라우팅, drag&drop, 숨김 `<input>` 연결, File System Access API + `<input>` fallback |
| `App.tsx:820-1375` | **Command Palette 자유 텍스트 문법 해석기**(약 555줄) — `handleCommandPaletteSubmit`, `runMenuAction`, `runAppAction`(190줄 switch, `App.tsx:962-1133`), `runQuickPaletteCommand`, `runExpressionText`, `jumpToSection`, `jumpToBar`, `changeViewFromPalette`, `zoomFromPalette`, `setTimeSignatureFromPalette`, `addBarsFromPalette`, `repeatBarsFromPalette`, `applyPatternFromPalette`, `unsetPaletteEffect` |
| `App.tsx:1377-1421` | 재생 트랜스포트: `startPlayback`, `stopPlayback` |
| `App.tsx:1423-1532` | 커서/선택/편집 트랜잭션 헬퍼: `editWithCursor`, `updateCursorSelection`, `copySelection`, `pasteClipboard` |
| `App.tsx:1534-1556` | **DOM hit-testing 핸들러**: `handleScoreClick`(렌더된 SVG의 `data-hit-ref`/`data-hit-kind`/element `id` suffix를 읽음), `handleScoreKeyDown` |
| `App.tsx:1557-1722` | Song/Track/시스템 CRUD 핸들러(`handleSongInfoChange` … `handleTrackMove`) |
| `App.tsx:1724-2025` | Voice/드럼/믹서/오토메이션/도구 요청 핸들러(`handleVoiceSelect` … `handleCleanupRequest`) |
| `App.tsx:2027-2132` | JSX 반환 — `<EditorShell>`에 60개 이상의 개별 콜백 prop 전달 + 숨김 file `<input>` |
| `App.tsx:2135-2541` | 모듈 레벨 순수 헬퍼(포맷/라벨 매핑, blob 다운로드, SVG→PNG 캔버스 래스터화, 에러 헬퍼, 메트로놈/count-in 이벤트 합성, 오토메이션 수학, 커서/마디 범위 헬퍼) |

**한 파일에 뒤섞인 책임(“현재 문제점” 근거):** 커맨드 등록 부트스트랩, 4개 스토어 구독, **레지스트리를 우회하는 독립적인 전역 키보드 단축키 시스템 2벌**, 전체 다중 포맷 파일 I/O 레이어, 약 555줄짜리 팔레트 문법 해석기, 재생 트랜스포트, DOM/SVG hit-testing, 약 30개 개별 score-mutation 핸들러 — 이 모두가 하나의 2544줄 함수 컴포넌트 안에 훅/모듈 추출 없이 들어있다.

### `src/ui/shell/EditorShell.tsx` (1174줄)

| 영역 (file:line) | 책임 |
|---|---|
| `EditorShell.tsx:31-109` | `EditorShellProps` — **필드 109개**(state + 콜백 45개) |
| `EditorShell.tsx:111-190` | 정적 설정 테이블: `noteDurations`, `barSymbolButtons`, `noteEffectButtons`, `beatEffectButtons`, `songFields`, `eqPresets`, `effectSlotButtons`, `displayModeButtons` |
| `EditorShell.tsx:192-286` | `EditorShell(props)` — 루트 레이아웃 조립. boolean prop만으로 8개 패널/오버레이 컴포넌트를 조건부 마운트; 겹치는 절대좌표 overlay들의 쌓임 순서는 오직 CSS `z-index`(20/22/24/26/28) 하드코딩으로만 제어되고 prop 기반이 아님 |
| `EditorShell.tsx:288-298` | `MenuBar()` — `MENU_TREE` 최상위 이름을 버튼으로 렌더링하되 **onClick도 서브메뉴도 없음**(§6/§7 참고) |
| `EditorShell.tsx:300-502` | `Toolbar(props)` — 약 200줄, 15개 `toolbarGroup` 영역, 그중 다수가 CSS로 숨겨진 죽은 그룹(`.zoomGroup` 398-406, `.displayGroup` 407-413, `.transportLegacy` 444-450, `.utilityLegacy` 493-498) |
| `EditorShell.tsx:504-522` | `TabBar` — 문서 탭 + "+" 버튼 렌더링, **onClick이 어디에도 없음** |
| `EditorShell.tsx:524-614` | `EditionPalette` — voice 선택기, multivoice 토글, `PaletteGroup` 8개(그중 Design/Lyrics/Chords/Notation symbols/Automation symbols 4개는 `disabled` 플레이스홀더) |
| `EditorShell.tsx:616-637` | `PaletteGroup` — 제네릭 래퍼; 기본 자식은 disabled "▸" 플레이스홀더 버튼 |
| `EditorShell.tsx:639-794` | `InspectorPanel(props)` — Song + Track 인스펙터; EQ/effect-slot 버튼 블록(771-787)이 아래 `TrackMixerStrip`과 거의 중복 |
| `EditorShell.tsx:796-848` | `GlobalView(props)` — 트랙 스트립 목록 + 마디 그리드, `score.masterBars.length`로부터 계산한 인라인 `style={{gridTemplateColumns: ...}}` |
| `EditorShell.tsx:850-982` | `TrackMixerStrip(props)` — `InspectorPanel`의 믹서/이펙트 버튼 마크업과 거의 중복(963-979가 771-787을 반영) |
| `EditorShell.tsx:984-1134` | `AutomationEditor` + `handleAutomationLaneClick` + 순수 수학 헬퍼 6개 — 좌표 계산이 `.automationLane`의 `getBoundingClientRect()`에 결합 |
| `EditorShell.tsx:1136-1173` | 순수 헬퍼: `currentLcdStatus`, `nextNotationTypes`, `titleWithShortcut`, `clamp` |

## 2. 상태 소유권 지도

| 상태 | 소유자 | 비고/중복 |
|---|---|---|
| Score/문서(노트, 트랙, 메타, stylesheet, documentSettings 내 **zoom**·**displayMode**) | `documentStore.ts:19-31`(`score`,`dirty`,`documents`,`activeId`,`undoStack`,`redoStack`) | `transact`를 통한 편집의 단일 소스. `documents[]`(다중 문서 탭용)가 존재하지만 UI에서 탭 전환/생성이 전혀 불가능(§7 참고) — 실질적으로 죽은 상태 |
| 커서/선택 | `viewStore.ts:4-13,25-34`(`cursor`,`selection`) | **`viewStore.zoom`/`setZoom`(viewStore.ts:7,12,28,33)과 `patchCursor`/`setStaffKind`(9,11,30,32)는 죽은 export — `src/**/*.tsx` 어디서도 읽거나 호출하지 않음.** 실제 zoom 값은 `score.documentSettings.zoom`에 있음(`App.tsx:1684-1690`에서 mutate, `App.tsx:293,299,1123,1126,2120` / `EditorShell.tsx:377-381` / `StylesheetPanel.tsx:278`에서 사용) — 진짜 "zoom" 슬롯 하나와 죽은 슬롯 하나가 공존하는 실제 중복 사례 |
| 재생(상태/bar·tick·time 포지션/루프·메트로놈·count-in/속도/믹서) | `playbackStore.ts:14-36` | 단일 소스. `App.tsx`는 `schedulerRef`(명령형 인스턴스, state 아님)만 보유 |
| 환경설정: `invertPlusMinus`, `panelVisibility`(palette/songInspector/trackInspector/globalView/automationView) | `preferencesStore.ts:13-21` | `localStorage`에 영속화(23,43-61,63-69). 단일 소스 |
| "도구 패널/트랙 패널/스타일시트 패널/파일 I/O 패널/커맨드 팔레트가 열려 있는가" | **`App.tsx:135-141` 로컬 `useState`**(`activeToolPanel`,`activeTrackPanel`,`stylesheetPanelOpen`,`fileIoPanelOpen`,`commandPaletteOpen`,`commandPaletteInitialValue`) | 위 `panelVisibility`와 **소유권 패턴이 불일치** — 구조적으로 동일한 "패널 open 여부" 계열인데 한쪽은 영속화된 zustand store, 한쪽은 비영속 로컬 state. Phase 5(layoutStore)에서 통합 대상 |
| `multiVoiceEdit`, `multiTrackView` | **`App.tsx:142-143` 로컬 `useState`** | 동일한 불일치 — `layoutScore`(`App.tsx:198`)와 다수 핸들러가 읽지만 `panelVisibility`/preferences처럼 store화되어 있지 않음 |
| `fileIoStatus`(상태줄 텍스트) | 로컬 `useState`(`App.tsx:139`) | 로컬로 두는 것 자체는 문제없으나 파일 I/O 서브시스템 전체의 성공/에러 메시지가 이 한 채널로 몰림 |
| 클립보드 payload | `clipboardRef`(React ref, `App.tsx:146`) | 리렌더 불필요이므로 ref로 둔 것은 정상 — 참고용으로만 기록 |
| 플랫폼 감지(`win`/`mac`) | **독립된 구현 2벌**: `preferencesStore.ts:26`(store 초기화 시 `navigator.platform...`)와 `commands/keymap.ts:220-222 detectPlatform()`(`App.tsx:144`에서 `useMemo`로 호출) | 두 곳이 같은 사실을 각자 계산. `preferencesStore.platform`은 설정만 되고 `src/**/*.tsx` 어디서도 읽지 않음 — `detectPlatform()`의 결과만 실제로 `props.platform`으로 전달되어 단축키 라벨 렌더링에 쓰임. 또 다른 죽은/중복 사실 |

## 3. 커맨드 실행 경로

메뉴바/툴바/에디션 팔레트/Command Palette/키보드 단축키 5개 진입점이 있지만 **모두 하나의 경로로 수렴하지 않는다**:

- **툴바 버튼** → `props.dispatchCommand(id)`(`EditorShell.tsx:415,418,428,431,434,437,440,469,472,475,478,484`) → `App.tsx:561-563 dispatchEditorCommand` → `executeCommand`(`commands/registry.ts:75-77`) → `commands/editingCommands.ts`에 등록된 커맨드. 일부 툴바 버튼은 대신 전용 `on...` prop을 통해 `App.tsx` 핸들러로 바로 감(`onTrackPanelOpen`,`onCommandPaletteOpen`,`onStylesheetPanelOpen`,`onToolOpen`,`onZoomChange`,`onDisplayModeChange`,`onToggleMultiTrackView` — `EditorShell.tsx:307-484`) — **레지스트리를 거치지 않음**.
- **에디션 팔레트 버튼** → `dispatchCommand(command)`(`EditorShell.tsx:555,562,566,569,572,575,585,590,597,604`) → 동일 레지스트리 경로.
- **Command Palette** → `CommandPalette.tsx:104 onSubmit(trimmed)` → `App.tsx:849 handleCommandPaletteSubmit` → `dispatchEditorCommand`(레지스트리) 또는 `runAppAction`(`App.tsx:962-1133`, 레지스트리와 별개인 190줄 switch).
- **메뉴바** → **아무것도 dispatch하지 않음** — `MenuBar()`(`EditorShell.tsx:288-298`)는 `MENU_TREE` 이름만 onClick 없이 렌더링. `MENU_TREE`의 `commandId`/`appAction`/`paletteInput` 데이터는 오직 Command Palette의 Action-List 모드(`@` 접두사, `commands/paletteCommands.ts:313-331 findMenuAction`, `App.tsx:939-960 runMenuAction`에서 호출)에서만 소비된다. **메뉴바 자체는 완전히 비활성.**
- **키보드 단축키**는 서로 통신하지 않는 **독립 구현 3벌**로 나뉜다:
  1. `commands/keymap.ts`(`KEYMAP_ENTRIES`, scope `"workspace"`) + `commands/editorKeymap.ts:75-85 commandIdForEvent` → 악보 뷰포트의 `onKeyDown={handleScoreKeyDown}`(`App.tsx:1553-1555, 2113`)에 연결 → `executeCommand` → 레지스트리. **레지스트리를 실제로 거치는 유일한 경로.**
  2. **App.tsx 안의 독립 `window.addEventListener("keydown", ...)` 2벌**: `App.tsx:212-231`(F2/F5/F6/F8/F10)과 `App.tsx:233-379`(capture phase, 약 20개 추가). 컴포넌트 핸들러를 직접 호출해 `commands/registry.ts`와 `commandIdForKeyEvent`를 완전히 우회 — `KEYMAP_ENTRIES`는 이 동일 단축키들에 대해 `scope: "global"` 항목을 선언하고 있음(`keymap.ts:57-120,189-217`)에도 불구하고. **`commandIdForKeyEvent`는 오직 `scope: "workspace"`로만 호출되며(`editorKeymap.ts:84`), `KEYMAP_ENTRIES`의 `"global"` scope 항목들은 어떤 리스너에서도 dispatch되지 않는다 — 오직 `shortcutLabel()` 툴팁 텍스트 생성에만 쓰인다**(`keymap.ts:228-231`, `EditorShell.tsx:1166-1169`에서 사용).
  3. `commands/shortcuts.ts` — **완전히 죽은 코드**. `dispatchShortcut`/`isShortcutMatch`를 export하지만 파일 자신 외에는 `src` 전체에서 호출부가 0건.

### 발견한 구체적 중복 로직 / 동작 불일치 사례

| # | 동작 | 경로 A | 경로 B | 불일치 내용 |
|---|---|---|---|---|
| 1 | **Stylesheet 패널 토글(F7)** | `App.tsx:285-289` — 하드코딩 `setStylesheetPanelOpen(v => !v)`(토글) | `EditorShell.tsx:354` Style 버튼 / `App.tsx:1119-1121 view.stylesheet` appAction — `setStylesheetPanelOpen(true)`(**강제 open만, 닫는 기능 없음**) | **실제 동작 버그 위험**: F7은 패널을 닫을 수 있지만, Style 툴바 버튼과 `view.stylesheet` 커맨드는 절대 닫을 수 없다 |
| 2 | **멀티트랙 뷰 토글(F3)** | `App.tsx:323-327` — 하드코딩 `setMultiTrackView(v => !v)` | `App.tsx:1815-1817 handleToggleMultiTrackView`(`view.multitrack` appAction `App.tsx:1116-1118`, `EditorShell.tsx:458 onClick={props.onToggleMultiTrackView}`에서 호출) — 역시 `setMultiTrackView(v => !v)` | 현재는 결과가 같지만 동일 토글이 독립된 코드 경로 2곳에 존재. `keymap.ts:120`(`view.multitrack`, scope global)도 별도 선언되어 있으나 dispatch되지 않음 |
| 3 | **멀티보이스 토글(Ctrl+M)** | `App.tsx:329-334` — 하드코딩 `setMultiVoiceEdit(v=>!v)` + `setActiveTrackPanel("voices")` | `App.tsx:1079-1082 voice.toggleMulti` appAction → `handleToggleMultiVoice()`(`App.tsx:1811-1813`) + `setActiveTrackPanel("voices")` | 복합 로직이 두 곳에 중복. `keymap.ts:115`에도 별도 선언(dispatch 안 됨) |
| 4 | **New/Open/Save/Save-As(Ctrl+N/O/S/Shift+S)** | `App.tsx:261-283` — 하드코딩, `handleNewFile()`/`handleOpenNativeFile()`/`handleSaveNativeFile()`/`handleSaveNativeFileAs()` 직접 호출 | `App.tsx:964-975` `runAppAction`의 `file.new/open/save/saveAs` 케이스가 **동일** 함수 호출 | 동일 함수를 재사용하므로 동작 버그는 아니지만, 레지스트리를 매개하지 않는 독립 트리거 메커니즘 2벌이 spec §12 원칙 1("공유 레지스트리 단일화")과 모순 |
| 5 | 백엔드 구현 없는 메뉴 항목 | `paletteCommands.ts:187` `app.preferences`(commandId, `src` 어디에도 `registerCommand` 없음) | — | `runMenuAction`(`App.tsx:939-960`)이 `dispatchEditorCommand("app.preferences")` 호출 → `registry.ts:42-54`가 `Unknown command` throw → catch되어 `"Preferences is not available here."` |
| 6 | 위와 동일 | `paletteCommands.ts:260,265` `tabs.next`/`tabs.previous`(미등록) | — | 동일 실패 패턴 |
| 7 | 위와 동일 | `paletteCommands.ts:265` `help.gettingHelp`(미등록) | — | 동일 실패 패턴 |
| 8 | `view.fullScreen`(Window 메뉴, `paletteCommands.ts:262`, appAction) | `App.tsx:962-1133 runAppAction` switch에 **해당 case 없음** | — | default로 빠짐: `"${label} is not implemented yet."`(`App.tsx:1132`). `F11`이 `keymap.ts:67`에 선언되어 있으나 global scope는 dispatch 안 되므로(§3) Full Screen은 spec §7.1 요구에도 불구하고 **작동 진입점이 0개** |
| 9 | `app.about`(Help 메뉴) | `demoCommands.ts:12-19`가 `"app.about"`을 `DemoCommandState`(`{lastMessage}`) 형태로 등록하지만 실제로는 `EditorCommandContext`(`App.tsx:381 editorContext`)로 실행됨 | — | 존재하지 않는 프로퍼티(`lastMessage`)에 쓰지만 throw는 안 함(JS라 타입체크 없음) — 어디서도 읽거나 표시하지 않는 사실상 가짜 커맨드 |

## 4. `App.css` 인벤토리

- **선택자 블록 수:** 194개 규칙 블록
- **색상 팔레트:** hex 리터럴 **89종**, CSS custom property(디자인 토큰) **0개**(`:root`는 `color`/`background`만 평문으로 설정, `App.css:1-9`). 가장 많이 재사용된 색: `#edf3f6`(9회, 기본 텍스트), `#f7c75f`(8회, amber/오토메이션 강조), `#6fb99f`(8회, 주 teal/green 강조), `#383b34`(7회, 패널 보더), `#151814`(7회, 입력/어두운 표면), `#aab7be`(6회, 보조 라벨), `#dbe8e4`(5회), `#9fd9c6`(5회, 팔레트 헤더 teal), `#84d1b6`(5회, 포커스 링), `#111410`(5회, 깊은 표면). 나머지 약 65개 색은 1회성 사용 — 공유 토큰 없이 컴포넌트별로 손으로 맞춘 다크 테마임을 시사
- **border-radius:** `2px`(×2), `3px`(×1), `4px`(×3), `5px`(×4), `6px`(×9), `8px`(×4), `50%`(×2, 원형), `999px`(×1, pill) — 비원형 반경 7종, 일관된 스케일 없음
- **간격(gap):** `1~10px`, `22px` 모두 사용, `6px`(×16)·`8px`(×10)가 우세하지만 `3/5/7/9px` 등 1회성 값도 다수 — 4/8 기반 시스템이 강제되지 않음
- **죽은/레거시 CSS 블록(JSX는 여전히 렌더링하지만 CSS가 영구적으로 숨기는 것):**
  - `.transportLegacy, .utilityLegacy { display: none; }`(`App.css:106-109`) — `EditorShell.tsx:444-450`, `493-498`의 버튼 그룹(disabled ghost 버튼 5+7개)을 매 렌더마다 DOM에는 마운트한 채로 숨김
  - `.zoomGroup, .displayGroup { display: none; }`(`App.css:161-164`) — `EditorShell.tsx:398-406`, `407-413`을 숨김
  - `.utilityGroup button:nth-last-child(-n + 3), .printGroup { display: none; }`(`App.css:213-216`) + `@media (min-width: 1280px) { ... display: flex; }`(`App.css:1381-1386`) — 툴바의 유일한 "반응형" 처리가 이 뷰포트 폭 기준 + DOM 순서 의존 셀렉터임(§8 위험 5 참고)
- **CSS 클래스 사용 감사:** `App.css`에 정의된 모든 클래스명을 `src/**/*.tsx` 전체와 단어 경계 매칭으로 대조한 결과 **죽은 클래스 0개** — 129개 셀렉터 모두 어딘가에서 참조됨(`.scorePage`/`.scorePages`는 감사 대상 파일 밖인 `src/engine/render/SvgRenderer.tsx:12,16`에서 사용 확인).

## 5. 고정 absolute 좌표 오버레이

TSX의 인라인 `style`에는 positioning이 전혀 없음(`background`/`gridTemplateColumns`/`gridRow`만 인라인 사용) — 모든 좌표는 CSS에 있음.

| 선택자 | file:line | 값 |
|---|---|---|
| `.commandPalette` | `App.css:251-255` | `position:absolute; z-index:28; top:124px; left:226px; right:300px;` |
| `.toolPanel, .trackSystemPanel, .stylesheetPanel, .fileIoPanel`(공통 블록) | `App.css:821-825` | `position:absolute; z-index:20; top:92px; left:226px; right:300px;` |
| `.trackSystemPanel`(override) | `App.css:836-840` | `z-index:22; left:248px; right:324px;` |
| `.stylesheetPanel`(override) | `App.css:842-847` | `z-index:24; left:220px; right:280px;` |
| `.fileIoPanel`(override) | `App.css:849-854` | `z-index:26; left:220px; right:280px;` |
| `.automationPoint` | `App.css:800-802` | `position:absolute;`(퍼센트 `left`/`top`은 `EditorShell.tsx:1052-1055`에서 포인트별 인라인 주입) |
| `.automationLane` | `App.css:788-790` | `position:relative;`(위 포인트들의 포지셔닝 컨텍스트) |

5개 플로팅 패널 모두 팔레트(214px)/인스펙터(286px) 고정폭과 헤더 스택(92px/124px) 고정 높이(`.gpShell` grid-template-rows, `App.css:56`)를 전제로 손으로 맞춘 매직넘버다. CSS 커스텀 프로퍼티도, 그리드 기반 `calc()`도, `ResizeObserver` 기반 위치 계산도 없다(§8 위험 3 참고).

## 6. `MENU_TREE` 구조

`commands/paletteCommands.ts:168-268`에 **최상위 메뉴 12개**(spec §2.8과 일치): File(18, 168-188), Edit(6, 189-196), Track(4, 197-202), Bar(5, 203-209), Note(4, 210-215), Effects(5, 216-222), Section(3, 223-227), Tools(7, 228-236), Sound(3, 237-241), View(15, 242-258), Window(3, 259-263), Help(2, 264-267) — **총 75개 메뉴 액션**.

각 `MenuAction`(`paletteCommands.ts:23-29`)은 세 가지 디스패치 방식 중 하나를 **일관성 없이** 사용한다: `commandId`(레지스트리 직결, Edit/Bar-symbol/Note/Effects/Section·Sound 대부분), `appAction`(`App.tsx:962-1133 runAppAction` switch, File/Track/Tools·View 대부분/Window의 `view.fullScreen`), `paletteInput`(팔레트 텍스트 문법 재진입, File의 import/export 하위항목, Section의 next/previous, View의 display-mode 항목).

**렌더링 확인:** 실제 드롭다운이 아님을 확인했다. `EditorShell.tsx:288-298`:
```tsx
function MenuBar() {
  return (
    <nav className="menuBar" aria-label="Application menus">
      {MENU_TREE.map((menu) => (
        <button key={menu.name} type="button">{menu.name}</button>
      ))}
    </nav>
  );
}
```
12개 최상위 이름만 `onClick`도 `aria-haspopup`도 서브메뉴 마크업도 없이 렌더링된다. `MENU_TREE`의 풍부한 항목 데이터(`commandId`/`appAction`/`paletteInput`/shortcut)는 오직 Command Palette의 Action-List 모드(`@` 접두사 → `paletteCommands.ts:313-331 findMenuAction` → `App.tsx:939-960 runMenuAction`)에서만 소비된다. **메뉴바 자체는 장식용/비활성 상태다.**

## 7. 알려진 플레이스홀더/비작동 UI

| file:line | 렌더되는 것 | 비작동 이유 |
|---|---|---|
| `EditorShell.tsx:288-298` | 메뉴바 버튼 12개(File…Help) | onClick 없음, 서브메뉴 없음 — 클릭해도 아무 일도 없음 |
| `EditorShell.tsx:504-522`(`TabBar`) | 문서 탭 버튼 + trailing "+" | 둘 다 onClick 없음; `EditorShellProps`(31-109)에 `onTabSelect`/`onTabCreate` prop 자체가 없음. `documentStore.documents`가 항상 고정 `"demo"` 항목 1개뿐이라(`documentStore.ts:36,44`) 다중 문서 UI가 완전히 비활성 |
| `EditorShell.tsx:398-406`(`.zoomGroup`) | `− / 100% / +` 버튼, 전부 disabled | `App.css:161-164`로 영구 `display:none`, 정상 동작하는 `.liveZoomGroup`(376-384)에 의해 대체됨 |
| `EditorShell.tsx:407-413`(`.displayGroup`) | `P/H/G/S` 버튼, 전부 disabled | 동일 — `display:none`, `.liveDisplayGroup`(385-397)로 대체됨 |
| `EditorShell.tsx:422-426`(`.printGroup`) | Print 버튼, 하드코딩 disabled | 실제 커맨드는 존재(`App.tsx:1012-1014 file.print → window.print()`, `paletteCommands.ts:61,186`)하지만 툴바상 유일한 Print 진입점이 영구 비활성 |
| `EditorShell.tsx:444-450`(`.transportLegacy`) | ⏮ ◀ ■/▶ ▶ ⏭, 전부 disabled | `display:none`(`App.css:106-109`); 바로 위 정상 `.transportGroup`(427-443)과 중복 |
| `EditorShell.tsx:461,464` | `.lcd` 내부 disabled 아이콘 버튼 2개(♫, ⚙) | 핸들러 미할당. spec §2.2(`specs/01-...md:96-97`)는 트랙 전환 팝업과 템포 오토메이션 에디터를 열어야 한다고 명시하지만 미구현 |
| `EditorShell.tsx:493-498`(`.utilityLegacy`) | `Loop/100%/C/Audio/View/Tune/Line`, 전부 disabled | `display:none`(`App.css:106-109`); `.playbackTools`(468-492)로 완전히 대체됨 |
| `EditorShell.tsx:550-552` | `Design`, `Lyrics`, `Chords` `PaletteGroup`, disabled | 각각 disabled "▸" 플레이스홀더만 렌더(`PaletteGroup` 기본 자식, 629-633). 참고: 별도로 완전히 동작하는 "Chords" 도구가 이미 존재(Toolbar "Chord" 버튼 → `onToolOpen("chords")` → `ToolPanels.tsx:80-145`) — 동작이 다른 "Chords" 진입점이 두 곳 |
| `EditorShell.tsx:609-611` | `Notation symbols`, `Automation symbols` `PaletteGroup`, disabled | 동일 플레이스홀더 패턴 |
| `App.tsx:1132`(`runAppAction` default) | switch가 커버 못하는 모든 appAction/메뉴 항목 | `"${label} is not implemented yet."` 반환 — 확인된 도달 케이스: `view.fullScreen`(`paletteCommands.ts:262`) |
| `commands/registry.ts:42-54` unknown-command 경로 | `app.preferences`(`paletteCommands.ts:187`), `tabs.next`/`tabs.previous`(260,261), `help.gettingHelp`(265) | `MENU_TREE`에서 참조되지만 `src` 어디에도(`editingCommands.ts`, `demoCommands.ts`) 등록되지 않음 — dispatch 시 `Unknown command` throw, catch되어 "…is not available here."로 표시 |
| `demoCommands.ts:12-19` | `app.about` | `DemoCommandState` 형태로 등록되지만 실제로는 `EditorCommandContext`로 실행됨; 아무도 읽지 않는 필드에 씀 — 사실상 no-op |
| `commands/shortcuts.ts`(전체 100줄) | `dispatchShortcut`, `isShortcutMatch`, `ShortcutDispatchOptions` | **완전히 죽은 코드** — `src` 전체에서 import 0건 |

## 8. UI 리마스터 시 회귀 위험이 큰 코드 경로 (12개)

1. **`App.tsx:1534-1551 handleScoreClick`** — `(event.target as Element).closest("[data-hit-ref]")`로 DOM을 타고 올라가고, 클릭된 SVG 요소의 `id` suffix(`"-head"`/`"-tab"`, `App.tsx:1543-1547`)를 문자열로 매칭해 커서 위치/staff 종류를 판정한다. 악보 SVG를 추가 오버레이 `<div>`로 감싸거나, 렌더러의 `id` 스킴을 바꾸거나, 클릭을 SVG 도달 전에 가로채면 컴파일 에러 없이 노트 커서 배치가 조용히 깨진다.
2. **`EditorShell.tsx:1075-1088 handleAutomationLaneClick`** — `event.currentTarget.getBoundingClientRect()` 퍼센트 계산으로 tick/value를 산출하고, **`EditorShell.tsx:1052-1055`**는 각 `.automationPoint`를 동일한 퍼센트 계산의 인라인 `left`/`top`으로 렌더한다. `.automationLane`의 padding/border(`App.css:788-798`)를 바꾸면 클릭 계산과 렌더 계산이 에러 없이 어긋난다.
3. **하드코딩된 플로팅 패널 오프셋**(`App.css:251-255, 821-854`, §5) — 고정된 팔레트/인스펙터 폭과 고정된 헤더 스택 높이를 전제한다. 팔레트를 리사이즈/접거나 툴바에 한 줄을 추가하면 Command Palette, Tool Panel, Track System Panel, Stylesheet Panel, File I/O Panel이 동시에 어긋난다.
4. **`.gpShell` grid**(`App.css:56`) — `grid-template-rows: 32px 54px 38px minmax(0,1fr) minmax(220px, 30vh)`로 메뉴/툴바/탭바 높이를 하드코딩. 툴바 콘텐츠가 두 줄로 감싸지는 상황(반응형 리마스터 중 발생 가능)에서 reflow 대신 그대로 잘린다.
5. **`.utilityGroup button:nth-last-child(-n+3)` + `.printGroup` 반응형 전략**(`App.css:213-216, 1381-1386`) — 뷰포트 폭 media query에 반응하며, `.utilityGroup` 내부 DOM 자식 개수/순서에 `nth-last-child`가 의존한다. `EditorShell.tsx`의 죽은 코드인 `.utilityGroup.utilityLegacy` 블록(493-498)이 되살아나거나 재구성되면 이 media query가 영향을 주는 버튼이 조용히 바뀐다.
6. **전역 keydown 리스너 2벌 + 악보 뷰포트 자체의 `onKeyDown`** — `App.tsx:229`(bubble, capture 옵션 없음), `App.tsx:377`(`{capture:true}`), `App.tsx:2113`의 `.scoreViewport` `onKeyDown={handleScoreKeyDown}`(bubble, React synthetic)이 서로 다른 capture/bubble 타이밍으로 겹쳐 있다. `App.tsx:377`이 `window`의 capture phase에서 실행되므로 항상 악보 뷰포트보다 먼저 키를 본다. 리마스터 중 새 포커스 가능한 오버레이/포털을 도입하면(현대적 컴포넌트 라이브러리에서 흔함) 특정 키를 어느 레이어가 먼저 처리할지가 바뀌어, 현재는 이 특정 순서 덕분에만 동작하는 노트 입력 단축키가 조용히 깨질 수 있다.
7. **`EditorShell.tsx` prop-spread 팬아웃** — `<Toolbar {...props} />`(196), `<InspectorPanel {...props} />`(245), `<AutomationEditor {...props} />`(256), `<GlobalView {...props} />`(257), `<TrackMixerStrip key={track.id} track={track} {...props} />`(820) 모두 109개 필드 `EditorShellProps` 전체를 spread로 전달한다. `EditorShellProps`(31-109)의 prop을 rename/삭제해도 실제 사용 지점에는 로컬 컴파일 에러가 나지 않고, 그 필드를 destructure하는 하위 컴포넌트 안에서만 깊숙이 에러가 난다 — 리마스터 중 prop rename을 grep만으로 놓치기 쉽다.
8. **`App.tsx:962-1133 runAppAction`**(appAction switch)은 `MENU_TREE.appAction`에서 온 문자열과, 버튼 콜백 체인을 거쳐 간접적으로 오는 하드코딩 리터럴 문자열로만 도달한다. 공유 enum/union이 없어 버튼 배선을 리네임하면 버튼이 쓰는 문자열과 switch의 `case` 라벨이 타입 에러 없이 어긋날 수 있다(`default`가 조용히 삼킴, 1128-1132).
9. **숨김 native `<input type="file">`**(`App.tsx:2125-2130`, class `hiddenFileInput`, `App.css:959-961`)은 `requestFileLoad`(`App.tsx:774-785`) 내부의 `fileInputRef.current.click()`으로만 트리거된다. 가시적 UI가 전혀 없고 `<EditorShell>`의 형제로 렌더된다(`App.tsx:2027-2131`, `EditorShell` 트리 밖). `FileIoPanel`을 포털/모달 라이브러리로 옮기며 이 형제 `<input>`과 분리시키면, 실제로 클릭을 시도하기 전까지는 아무 시각적 징후 없이 모든 Import/Open-fallback 흐름이 깨진다.
10. **`GlobalView`의 마디 그리드**(`EditorShell.tsx:823-845`)는 `score.tracks.length × score.masterBars.length`개의 개별 `<button>`을 가상화 없이 렌더하며 인라인 `gridTemplateColumns: repeat(${masterBars.length}, 42px)`(823)을 사용한다. 기본 스코어 길이나 트랙 수를 늘리는 리마스터는 이 마크업 구조에서 곧바로 DOM 노드 수 성능 절벽에 부딪힌다.
11. **CSS 클래스명이 동작 상태 훅을 겸함** — `"activeToggle"`이 `EditorShell.tsx` 15곳 이상(패널 토글, 재생 토글, display-mode 선택, 믹서 mute/solo/visible, stylesheet 프리셋 버튼 등, 337,390,458,469,472,475,779,880,888,896 / `StylesheetPanel.tsx:86,256`)에서 순수 문자열 리터럴 삼항식으로 적용된다. 공유 "active button" 컴포넌트가 없어, `App.css`에서 이 클래스명을 리네임하려면 이 모든 문자열 리터럴을 손으로 찾아 고쳐야 하고 부분 리네임은 조용히 시각-상태 불일치를 만든다.
12. **`CommandPalette.tsx`의 고정 4컬럼 입력 그리드**(`App.css:265-273`, `grid-template-columns: 42px minmax(0,1fr) 58px 30px`)는 현재 1~2글자 접두 글리프(`?`,`@`,`>`,`$`,`:`, `CommandPalette.tsx:166`)에 맞춰져 있다. 더 긴 접두 라벨(다국어 등)을 도입하면 42px 컬럼이 반응형 대응 없이 잘리거나 넘친다.

## 9. `specs/01-UI-구조와-내비게이션.md` 요약

6패널 구조: ① **툴바**(15개 그룹, Home→패널토글→Zoom→Display모드→Undo/Redo→Print→Transport→LCD→Loop/Speed→Global tonality→Audio track→Instrument views→Tuner→Line-in→Fretlight, ResizeObserver 기반 반응형 우선순위 필요) ② **문서 탭 바**(무제한 문서, overflow 스크롤, dirty-dot/lock 배지, hover 시 Save/Close, 우클릭 컨텍스트 메뉴, trailing "+") ③ **에디션 팔레트**(F2, 10개 그룹: voice 선택기·multivoice·design·lyrics·chords·bar symbols·note symbols·effect symbols·notation symbols·automation symbols, 우클릭/롱프레스로 추가 옵션) ④ **워크스페이스**(중앙 악보, hover 시 blue 하이라이트, 클릭은 편집 다이얼로그를 열 뿐 노트를 삽입하지 않음) ⑤ **인스펙터**(F5 Song / F6 Track 독립 토글, Song은 title/artist 등+notation+mastering+concert-tone, Track은 name/short/color/icon+notation/tuning+transposition+interpretation) ⑥ **글로벌 뷰**(F8, 리사이즈 가능, 믹서+미니맵 통합: Add-track/트랙명/재정렬/멀티트랙 토글/mute·focus·solo/volume+automation/pan+automation/EQ/마디 그리드, 그리드 클릭이 트랙+마디를 동시 선택, 편집 커서를 자동 스크롤로 추적).

추가 구조: **최상위 메뉴 12개**(File/Edit/Track/Bar/Note/Effects/Section/Tools/Sound/View/Window/Help)가 전체 위에 위치하며 spec §12 원칙 1에 따라 툴바/팔레트/Command Palette와 **단일 커맨드 레지스트리**를 공유해야 한다. **Command Palette**(`Ctrl+E`)는 탭 바 바로 아래에 도킹되며 `?`/`@`/`>`/unset 접두사 + quick 명령 약 32개 + advanced 명령 약 68개 + pattern 명령 9개를 지원한다(§9). 악보 **display mode 6종**(Vertical/Horizontal Page, Grid, Parchment, Vertical/Horizontal Screen)을 툴바 또는 View 메뉴로 전환한다(§4). 최소 지원 뷰포트는 **1024×768**(§7.2).
