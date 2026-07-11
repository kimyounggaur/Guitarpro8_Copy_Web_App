# Phase 0 — 인터랙션 매트릭스

측정 방법: 이 세션의 Browser 도구는 실제 픽셀 스크린샷 캡처가 불가능했으므로(00-baseline-audit.md §4 참고), 모든 항목을 실제 dev 서버(`npm run dev`, `http://localhost:5173`)에 대해 `read_page`(접근성 트리), `javascript_tool`(DOM 상태 조회/조작), `computer`(키 입력·ref 클릭)로 라이브 검증했다. 각 행의 "증거"는 실제 실행 결과다.

범례: **working** = 완전 동작 · **partial** = 동작하지만 목표 사양과 차이 있음 · **placeholder** = UI는 있으나 클릭해도 상태 변화 없음 · **broken** = 목표 기능이 전혀 없음(DOM에 부재)

| # | 항목 | 분류 | 증거 |
|---|---|---|---|
| 1 | F2 (Palette 토글) | **working** | F2 입력 전후 `.gpMain` 클래스가 `paletteHidden` 유무로 토글되고 `.palettePanel` 존재 여부가 실제로 바뀜을 확인 |
| 2 | F5 (Song Inspector 토글) | **partial** | F5 입력 시 `.inspectorPanel` 텍스트에서 `title`/`artist` 등 Song 필드가 사라졌다 나타남 — 토글 자체는 동작하나, GP8 목표는 SONG/TRACK을 배타적 **탭**으로 전환하는 것(Phase 11)인데 현재는 두 섹션이 같은 패널에 세로로 누적되는 구조라 "탭 전환"이 아니라 "섹션 개별 show/hide"에 가깝다 |
| 3 | F6 (Track Inspector 토글) | **partial** | 동일 방식으로 `Transposition` 등 Track 필드 유무가 토글됨을 확인. F5와 마찬가지로 배타적 탭이 아님 |
| 4 | F8 (Global View 토글) | **working** | F8 입력 시 `.bottomDock` 요소 자체가 DOM에서 사라졌다/나타났다 함을 확인 |
| 5 | F10 (Automation 토글) | **working** | F10 입력 시 `.bottomDock` 클래스에 `automationVisible`이 추가/제거됨을 확인 |
| 6 | 메뉴 버튼 클릭 (File/Edit/Track/Bar/Note/Effects/Section/Tools/Sound/View/Window/Help) | **broken** | "File" 버튼을 `ref` 클릭 직후 `[role="menu"], ul, .dropdown, .submenu, [class*="menu"]`를 전수 조회해도 `.menuBar` 자신 외에 새로 생성된 요소가 0개. 12개 메뉴 모두 이름만 있는 버튼이며 드롭다운이 전혀 없다 |
| 7 | 문서 탭 클릭(전환) | **not testable (탭 1개뿐)** | 현재 열린 문서가 "Phase 9 Tools Demo" 1개뿐이라 전환 자체를 실측할 수 없음. 아래 8번(+ 버튼)이 broken이라 새 탭을 만들어 전환을 재현하는 것도 불가능 |
| 8 | 탭 "+" 버튼(새 문서) | **broken** | 클릭 전/후 `.tabBar` 내부 버튼 목록(`activeTab` 1개 + `tabAdd` 1개)이 완전히 동일 — 새 탭이 생성되지 않음 |
| 9 | 탭 닫기 | **broken** | `.tabBar`의 자식 버튼을 전수 조회했을 때 닫기 버튼(×) 자체가 DOM에 존재하지 않음 |
| 10 | 좌/우/하단 패널 리사이즈(드래그) | **broken** | `[class*="splitter"], [class*="resize"], [role="separator"]` 전수 조회 결과 0건. 패널 폭/높이는 순수 CSS 고정값(팔레트 214px, 인스펙터 286px) |
| 11 | 재생(Play/Stop) | **working** | title `"Play / stop Space"` 버튼 클릭 시 하단 상태 텍스트가 `Bar 1 / Ready` → `Bar 1 / 15.2s`로 변경되어 실제 재생 엔진이 구동됨을 확인. 재클릭 시 정지 상태로 복귀 |
| 12 | Loop 토글 / 속도 변경 | **partial + 중복 의심** | title `"Loop F9"` 버튼과 title이 빈 문자열인 두 번째 "Loop" 버튼이 각각 별도로 존재함을 확인(`querySelectorAll('button')` 결과 2건) — §2.2(레거시 중복 그룹) 문제와 동일한 패턴으로, 어느 쪽이 실제 활성 경로인지 Phase 2/7에서 추가 조사 필요. Speed `-`/`100%`/`+` 버튼은 존재 확인, 클릭 동작까지는 이번 세션에서 미실측 |
| 13 | 에디션 팔레트 duration 입력 | **working (클릭 성공, 결과 미검증)** | 팔레트 내 텍스트 "4"(4분음표 duration) 버튼을 스코어에 포커스를 준 뒤 클릭 — 콘솔 에러 없이 클릭 완료. 실제 노트 duration이 바뀌었는지는 이번 세션에서 스코어 모델 상태까지 깊게 조회하지 않아 별도 확인 필요 |
| 14 | Command Palette 열기/닫기 | **working (단, 위치 하드코딩)** | `Ctrl+E`로 `.commandPalette`가 생성됨(`{x:226, y:124, width:739, height:291}`), `Flow`/`x:`/`@`/`$`/`4/4`/`add-bar` 등 다중 모드 커맨드 파서가 실제 표시됨. `Escape`로 정상적으로 닫힘(재조회 시 `.commandPalette` 없음). 단 위치가 `top:124px;left:226px;right:300px`로 좌/우 패널 폭에 종속된 하드코딩값(App.css:250-255) — Phase 15 대상 |
| 15 | Stylesheet / File I/O / Track(Tuning) / Tool 패널 열기 | **working (단, 고정 absolute 좌표)** | File I/O 버튼 클릭 → `.fileIoPanel` 생성, "New/Open/Save/Save As/Download/Import/Export" 텍스트 확인. Tuning 버튼 클릭 → `.trackSystemPanel` 생성, 런타임 `getComputedStyle`으로 `position:absolute; top:92px; left:248px; right:324px` 확인(패널 폭 종속 하드코딩, Phase 16 대상). 둘 다 닫기 버튼 클릭으로 정상적으로 사라짐 |
| 16 | 새 파일 / 열기 / 저장 | **present, not deeply exercised** | `.fileIoPanel`에 New/Open/Save/Save As/Download 버튼이 모두 존재하고 비활성화 상태가 아님을 확인. 실제 클릭은 OS 파일 피커/다운로드를 유발할 수 있어 이 read-only 감사 세션에서는 실행하지 않음(§1.2 지식재산/§다운로드 정책과 별개로, 자동화 세션에서 임의 파일 다운로드를 트리거하지 않기 위함). Phase 1(Playwright)에서 `testMode`를 이용해 안전하게 검증 예정 |

## 콘솔 / 접근성 관찰

- 위 16개 항목을 조작하는 동안 `read_console_messages(onlyErrors=true)`를 반복 조회했으며 **에러 0건**이었다.
- `read_page(filter: interactive)`로 확인한 주요 버튼들은 대부분 `title` 속성(툴팁 텍스트)을 갖고 있어 접근 가능한 이름 자체는 존재한다. 다만 File/Edit 등 12개 메뉴 버튼은 접근성 이름은 있지만 `aria-haspopup`/`aria-expanded` 등 메뉴 버튼에 기대되는 ARIA 상태가 없다(Phase 6/17에서 보강 필요 — 이번 세션에서는 속성 유무만 육안 확인, 전수 접근성 스캔은 axe-core 도입 후인 Phase 17에서 수행).

## 이번 감사에서 다루지 못한 항목 (다음 Phase에서 보강)

- 실제 `.png` 스크린샷 (00-baseline-audit.md §11 참고, Playwright 도입 후 보강)
- New/Open/Save의 실제 파일 다운로드/피커 결과
- 팔레트 duration/effect 클릭이 실제 score 모델에 반영되는지 (Zustand devtools 또는 별도 상태 조회 필요)
- Loop 버튼 중복 중 어느 쪽이 실제 활성 경로인지
