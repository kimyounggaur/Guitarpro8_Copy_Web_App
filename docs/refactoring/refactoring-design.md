# Guitarpro8_Copy_Web_App 리팩토링 설계서

| 항목 | 내용 |
|---|---|
| 문서 버전 | 1.0 (2026-11-23) |
| 근거 | 점검 결과 보고서 https://claude.ai/artifact/TU9yXYwJ7rcJtiaSJRRemS (요약본: 프로젝트 문서 `claude/guitarpro8-copy-점검결과.md`) |
| 대상 코드 | `remaster/phase-03-css-tokens` 브랜치 bd33397. main(7cc0a5d)의 내용을 모두 포함합니다. 2026-11-23에 두 브랜치 모두 점검 때와 같은 커밋임을 확인했습니다. |
| 읽는 사람 | 성태 님(진행 결정·결과 확인), 코드를 고칠 AI 코딩 도구 |
| 표기 | A1, B13 같은 번호는 보고서의 항목 번호입니다. `코드체`는 파일·함수 이름입니다. **(신규)** 는 새로 만드는 파일입니다. 줄 번호는 bd33397 기준입니다. |

> 이 설계서는 "무엇을, 어떤 순서로, 어떻게 고치고, 끝났는지 어떻게 확인하는지"를 정합니다. 저장소의 코드는 아직 바꾸지 않았습니다.

**목차**

0. 한눈에 보기
1. 목표와 범위
2. 전제와 결정 사항
3. 현재 구조와 목표 구조
4. 공통 작업 규칙(PR 흐름, 알려진 결함 테스트, 필수 검사, AI 공통 프롬프트)
5. 단계별 설계 R0~R9(각 단계: 목표 → 설계 → 작업 순서 → 재현 테스트 → 완료 기준 → 직접 확인 → 위험 → AI 프롬프트)
6. 데이터 모델과 저장 파일 형식의 변경
7. 테스트 전략
8. 추적표(보고서 50개 항목)
9. 순서와 규모
10. 전체 위험과 대응
11. 부록(용어 풀이, 외부 라이브러리, UI 리마스터 대응표, 파일별 변경 단계)

---

## 0. 한눈에 보기

**결론:** 지금의 구조(데이터 모델·엔진·화면 분리)는 유지하고 10단계(R0~R9)로 고칩니다. 새로 작성하는 것은 오선보 그리기, 재생 순서 계산, MusicXML·MIDI 입출력처럼 틀린 결과를 내는 부분으로 한정합니다. R0~R5가 끝나면 입력하고, 보고, 듣고, 저장하는 기본 사용이 가능해집니다. R6~R8은 파일 호환·도구 정확도·속도를, R9는 동작하지 않는 화면 요소 정리와 멈춰 둔 UI 리마스터 재개를 다룹니다.

모든 단계는 같은 순서로 진행합니다.

1. 문제를 재현하는 자동 테스트를 먼저 만듭니다. 이 시점에는 실패하는 것이 정상입니다.
2. 고칩니다. 테스트가 통과로 바뀝니다.
3. 자동 검사(타입 검사, 테스트, 빌드, 브라우저 테스트)를 모두 통과합니다.
4. 성태 님이 단계별 "직접 확인" 목록(5~10분 분량)으로 확인하고 병합을 승인합니다.

| 단계 | 이름 | 다루는 보고서 항목 | 끝나면 달라지는 점 | 크기 |
|---|---|---|---|---|
| R0 | 기반 정비 | D1(일부)·D2·D3·D4·D5 | 배포 설치가 성공하고, 올릴 때마다 자동 검사가 돌고, 알려진 결함이 테스트로 기록됨 | 작음 |
| R1 | 작업물 보호 | A9·A10·A11·B16·D1(확장자) | 흰 화면 대신 안내 창, 자동 저장과 복구, 닫기 경고, 트랙 꼬임 없음, 진짜 GP 파일은 안내 문구 | 중간 |
| R2 | 입력 흐름 | A1·A2·B1·B10·B12·C13·D6(단축키) | → 키·숫자·단축키·붙임줄·새 마디가 기대대로 동작 | 중간 |
| R3 | 화면 틀 | A3·A5·A6 | 1024px 이상에서 모든 버튼에 닿음, 쉼표·늘임표가 보임, 줄 겹침 없음 | 중간 |
| R4 | 오선보 다시 만들기 | A4·B11·C6·C7·B4(표기) | 오선보를 악보로 읽을 수 있고, 오선에서 음을 넣을 수 있음 | 큼 |
| R5 | 재생 | A7·A8·B2·B3·B4(소리)·B5·C4 | 깨지지 않는 소리, 맞는 재생 순서, 믹서 즉시 반영 | 큼 |
| R6 | 파일 | B13·B14·B15·C10·C11 | MusicXML·MIDI·PDF를 다른 프로그램과 주고받음 | 큼 |
| R7 | 도구 | B6·B7·B8·B9·B17·B19·C14 | 코드·스케일·조옮김·튜너가 정확, 여러 마디 복사 | 중간 |
| R8 | 성능 | B18·C5 | 100마디×8트랙에서도 편집 반응이 0.05초 안쪽 | 중간~큼 |
| R9 | 마무리·리마스터 재개 | C1·C2·C3·C8·C9·C12·D6(나머지) | 화면의 모든 버튼이 동작하거나 숨겨짐. 이후 UI 리마스터 Phase 4~19 진행 | 큼 |

보고서의 권장 순서(안전망 → 입력 → 화면 → 재생 → 파일 → 도구 → 성능 → 마무리)를 그대로 따랐습니다. 달라진 점은 두 가지입니다.

- B16(확장자)을 파일 단계가 아니라 R1로 당겼습니다. 파일을 열 때 형식을 검사하는 장치를 R1에서 만들기 때문입니다.
- C4·C5·C6·C7·C10·C11·C13·C14는 같은 코드를 고치는 단계로 옮겼습니다. 예를 들어 템포 표시(C4)는 템포 계산을 고치는 R5에서 함께 처리합니다.

크기는 코드 범위를 보고 잡은 상대 크기입니다(작음 = PR 1~3개, 중간 = 4~5개, 큼 = 6개 이상). 실제 기간은 R0~R1을 진행해 본 속도로 다시 어림하는 것을 권합니다.

---

## 1. 목표와 범위

### 1.1 완성 상태

리팩토링이 끝났을 때 이 앱은 다음을 할 수 있어야 합니다.

- 기타·베이스 TAB과 오선보를 키보드로 막힘 없이 입력합니다.
- 화면과 인쇄물에서 악보를 악보로 읽을 수 있습니다.
- 깨지지 않는 소리로, 도돌이표·코다 순서대로 재생합니다.
- 작업이 경고 없이 사라지지 않습니다.
- MusicXML·MIDI·PDF로 다른 프로그램과 주고받을 수 있습니다.

### 1.2 수치로 보는 완료 기준

| 항목 | 지금(보고서) | 목표 | 확인 방법 |
|---|---|---|---|
| 5, →, 7, →, 8 입력 결과 | 7, 8만 남음 | 5, 7, 8 | 브라우저 테스트 |
| 도구줄 필요 폭 | 2,353px | 1024px 화면에서 가로 스크롤 0, 재생 버튼 보임 | 브라우저 테스트(화면 4종) |
| 악보 줄 겹침 | 26px | 0px | 레이아웃 검사 테스트 |
| 데모곡 최대 음량 | +3.6 dBFS | −1 dBFS 이하 | 소리 테스트 |
| 데모곡 한계치 이상 구간 | 24.4초 | 0초 | 소리 테스트 |
| D.S. al Coda 재생 순서 | 1 2 3 4 7 8 | 1 2 3 4 5 6 2 3 4 7 8 | 단위 테스트 |
| 템포 램프 구간 위치 오차 | 최대 489틱 | 1틱 미만 | 단위 테스트 |
| 내보낸 MIDI | 표준 판독기가 거부 | 판독기 2종 통과 | 단위 테스트 |
| MusicXML 왕복 | 0/0 박자, 좌표 NaN 371개 | 지원 범위 안에서 원본과 같음 | 단위 테스트 |
| 100마디×8트랙 편집 반응 | 150~400ms | 50ms 미만(상위 5% 기준) | 성능 측정 |
| 같은 악보 커서 이동 | 144~184ms | 16ms 이하 | 성능 측정 |
| 편집 20회 뒤 메모리 증가 | +275MB | +50MB 이하 | 성능 측정 |
| 흰 화면 재현 사례 | 2건 | 0건 | 브라우저 테스트 |
| 접근성 검사 | 이름 없는 버튼 22개 | 심각·중대 위반 0건 | axe 검사 |
| "Unknown command" 단축키 | 20개 | 0개 | 단위 테스트 |
| 보안 경고(개발 도구) | 28건(중대 3, 높음 8) | 중대·높음 0건 | `pnpm audit` |

### 1.3 이번 리팩토링에서 하지 않는 것

- 실제 Guitar Pro 파일(.gp, .gpx, .gp5) 열기. 형식을 알아보고 안내 문구만 보여 줍니다(R1). 꼭 필요해지면 별도 계획으로 다룹니다(결정 6).
- 휴대폰에서 편집하기. 1024px 미만 화면에서는 안내 띠를 보여 줍니다(R3).
- 기획서에만 있고 아직 없는 기능(가사, 오디오 트랙, MIDI 건반 입력, 여러 문서 탭, 디자인 모드 등). R9에서 화면에서 숨기고 이후 기능 계획으로 넘깁니다.
- 실제 Guitar Pro 수준의 음색. R5에서 소리 깨짐을 없애고, 사운드폰트는 선택 작업(R5-B)으로 둡니다.

---

## 2. 전제와 결정 사항

### 2.1 보고서의 결정 7가지 — 이 설계가 따르는 안

보고서의 결정 1~7에 아직 답을 받지 않아 추천안을 전제로 설계했습니다. 다르게 정하시면 오른쪽 칸의 부분만 바뀝니다.

| 결정 | 이 설계의 전제(추천안) | 다르게 정하면 바뀌는 부분 |
|---|---|---|
| 1. 기준 브랜치 | remaster를 기준으로 삼고, 백업을 남긴 뒤 main을 remaster 내용으로 교체(R0) | main 기준이면 R0에 "remaster의 컨트롤러 분리·CSS 정리를 main으로 옮기기"가 추가되고, 이 문서의 `src/app/controllers/*` 경로는 main의 `src/App.tsx`로 바뀝니다. |
| 2. 지원 화면 | 1024px 이상 데스크톱 보장, 1280·1440px을 주로 검수. 1024px 미만은 안내 띠 | 휴대폰 편집까지 하려면 R9 뒤에 화면을 다시 설계하는 별도 단계가 필요합니다. |
| 3. 작업 순서 | 결함 수정(R0~R8)을 먼저, UI 리마스터 Phase 4~19는 R9부터. 리마스터 플레이북 §2.3의 "엔진 수정 금지"는 R 단계에 한해 예외로 바꿈 | 리마스터를 먼저 하면 R3의 도구줄 작업과 R9가 리마스터 Phase 7·6·14에 합쳐지고, 엔진 결함은 그동안 그대로 남습니다. |
| 4. 소리 | R5에서 기본 효과를 끄고 음량 구조를 다시 짬. 사운드폰트는 선택 작업 R5-B | 사운드폰트를 필수로 하면 R5에 PR 3~4개가 늘고 소리 파일 내려받기(수 MB)가 생깁니다. |
| 5. 이름·확장자·매뉴얼 PDF | R0에서 PDF를 저장소에서 빼고 표시 이름을 바꿈. 확장자는 R1에서 상수 한 곳(`NATIVE_EXTENSION`)으로 바꿈. 과거 기록에서 PDF를 지우는 일은 별도 결정 | 지금 하지 않으면 해당 작업만 미루고 나머지 설계는 그대로입니다. |
| 6. 엔진 | 자체 엔진 유지, 오선보 부분만 새로 작성(R4) | alphaTab으로 바꾸면 R3·R4·R5의 상당 부분이 대체되지만, 편집 기능은 여전히 직접 만들어야 하고 데이터 모델을 alphaTab 방식으로 옮겨야 합니다. |
| 7. 화면 언어 | R9에서 화면 문구를 한 곳에 모으는 구조만 먼저 만들고, 한국어 추가는 선택 | 한국어를 기본으로 하면 R9에 번역 작업이 더해집니다. |

### 2.2 설계하면서 제가 정한 기술 판단

사소한 기술 판단은 제가 정했습니다. 바꾸고 싶으신 것이 있으면 말씀해 주세요.

| 판단 | 내용 | 이유 |
|---|---|---|
| 단축키 충돌 | `Shift+.`는 점음표로 두고, 같은 키 조합이 되는 Fade Out(`>`)은 메뉴·팔레트로만 실행(R2) | 미국·한국 자판에서 `Shift+.`를 누르면 `>`가 입력되어 두 기능이 같은 키입니다. 점음표가 훨씬 자주 쓰입니다. |
| 붙임줄 저장 방식 | "앞 음에서 이어짐" 표시 하나로 저장(R2) | 명세(spec 02)의 정의와 같고, 마디를 넣거나 음을 지워도 연결이 엉뚱한 음을 가리키지 않습니다. |
| 숫자 입력 | 첫 숫자는 바로 입력하고, 0.3초 안에 둘째 숫자가 오면 두 자리 프렛으로 바꿈(R2) | "입력 대기" 상태가 없어져 A2 같은 꼬임이 구조적으로 생기지 않습니다. |
| 자동 저장 | 브라우저 안 저장소(IndexedDB)에 2초 간격, 최근 10개(R1) | 큰 악보는 수 MB라 localStorage(약 5MB 제한)로는 부족합니다. |
| 파일 검증 | 파일을 열 때 zod로 구조 검사(R1) | 손상된 파일이 앱 안으로 들어와 흰 화면을 만드는 것을 입구에서 막습니다. |
| 실행취소 | 이미 설치된 immer의 "변경분(패치)" 방식으로 교체(R8) | 지금은 편집 한 번에 악보 전체 사본 3개(약 13.8MB)를 쌓습니다. |
| PDF | 브라우저 인쇄 기능을 거쳐 PDF로 저장하는 방식을 기본으로(R6) | 악보 글꼴과 한글이 그대로 나옵니다. 직접 PDF 만들기는 나중 과제로 둡니다. |
| MIDI | 바이트를 직접 쓰지 않고 `midi-file` 라이브러리로 읽고 쓰기(R6) | 지금의 결함(길이 1바이트 오류)이 바로 직접 쓰기에서 나왔습니다. |
| 튜너 | `pitchy`(MIT, McLeod 방식)로 교체(R7) | 옥타브 오인과 저음 미검출을 줄이는 검증된 방식입니다. |
| 기타 오선보 | "높은음자리표 아래 8" 관례(실제 소리보다 한 옥타브 높게 적음)(R4) | 기타 악보의 표준 관례이며, 낮은 음에 덧줄이 지나치게 많아지는 것을 막습니다. |
| Node 버전 | 24 LTS로 고정(R0) | 지금 로컬 PC의 Node 25는 2026-06-01에 지원이 끝났고, 빌드 중 충돌 기록이 있습니다. 26 LTS도 가능하지만 이 도구 조합에서는 24가 더 오래 검증되었습니다. |

### 2.3 성태 님이 정하실 작은 것

| 무엇을 | 언제까지 | 참고 |
|---|---|---|
| 새 앱 이름과 확장자 | R1 시작 전 | 기획서의 `.gpw`도 가능하지만 "GP"를 떠올리게 하므로 새 이름의 약자를 권합니다. 정해지기 전까지 문서와 코드에는 자리표시자를 씁니다. |
| LICENSE 종류 | R0 | 파일이 없으면 다른 사람은 코드를 볼 수만 있고 법적으로 재사용할 수 없습니다. 공개 오픈소스로 둘 생각이면 MIT가 흔한 선택입니다. |
| 과거 기록 속 매뉴얼 PDF 삭제 | R0 | 기록을 다시 쓰는 작업이라 되돌리기 어렵습니다. 절차는 R0에 적었습니다. |
| 화면 언어 | R9 | 결정 7 참고 |

---

## 3. 현재 구조와 목표 구조

### 3.1 현재 구조

```text
화면(React)   src/app/App.tsx, src/app/controllers/*, src/ui/shell/*
   │  키·마우스 이벤트
명령          src/commands/*   (registry.ts, keymap.ts, editorKeymap.ts, shortcuts.ts)
   │
상태(store)   src/store/documentStore.ts  악보 + 실행취소(악보 전체 사본)
              src/store/viewStore.ts      커서·선택·줌
              src/store/playbackStore.ts  재생 상태 + 믹서
   │
엔진          src/engine/editing  layout  render  audio  unroll  tools  validate
데이터 모델   src/model/*   (types.ts, derive.ts, factory.ts, instruments.ts, chords.ts, scales.ts, tuner.ts)
파일 입출력   src/io/*      (nativeScore.ts, musicXml.ts, midi.ts, asciiTab.ts, pdfExport.ts, vectorExport.ts)
```

층이 잘 나뉘어 있고 엔진은 화면과 독립적으로 테스트할 수 있습니다. 이 장점은 그대로 둡니다.

### 3.2 결함 50건의 공통 원인 5가지

보고서의 결함은 대부분 아래 다섯 가지 원인에서 나옵니다. 설계 원칙(3.4)은 이 원인을 하나씩 막도록 정했습니다.

| 원인 | 대표 결함 | 실제 코드 |
|---|---|---|
| ① 오래된 값이나 "위치"로 대상을 가리킴 | A1, A11, B1, B14 | 커서를 수정 전 악보로 다시 계산(`useEditorController.ts` 179~181행). 붙임줄이 마디·박·음 번호로 상대를 가리킴(`types.ts`의 `NoteRef`). 트랙 번호를 앱 실행 후 생성 순서로 매김(`factory.ts` 66~102행). 가져온 음의 `midiPitch` 캐시가 프렛보다 우선(`derive.ts` 38~49행). |
| ② 화면·소리용 계산 결과와 원본 데이터가 섞임 | A8, B5, B18 | 믹서 설정을 음표 이벤트마다 구워 넣어(`compile.ts`, `mixer.ts`의 `buildNoteMix`) 재생 중 변경이 반영되지 않음. 커서 위치가 악보 레이아웃 계산의 입력이라(`App.tsx` 192~200행) 커서만 움직여도 악보 전체를 다시 계산. |
| ③ 데이터가 깨졌는지 검사하는 관문이 없음 | A9, B17, A11 | 줄 수를 줄여 음이 없는 줄을 가리켜도 그대로 저장되고, 그리는 순간 `stringPitch`가 오류를 던져 화면 전체가 멈춤(`derive.ts` 84~93행). |
| ④ 같은 정의가 여러 곳에 있음 | A6, B12, D6 | 시스템 높이를 `pageLayout.ts`의 `calculateSystemHeight`(트랙당 116px)와 `trackScene.ts`의 `trackHeight`(6현 156px)가 따로 계산. 단축키 정의가 `keymap.ts`·`shortcuts.ts`·`registry.ts`(Command.shortcut) 세 곳. |
| ⑤ 실제 동작을 확인하는 테스트가 없음 | 거의 전부 | 테스트 80개(remaster 91개)가 계산 함수 위주라, 키 입력·화면·소리·파일 왕복 결함을 잡지 못함. |

### 3.3 목표 구조

층 구조는 그대로 두고, 아래 모듈을 새로 만들거나 바꿉니다.

```text
src/model/
  ids.ts            (신규) 고유 ID 생성
  invariants.ts     (신규) 악보 불변식 검사(트랜잭션 관문)
  ties.ts           (신규) 붙임줄 원래 음 찾기·정리
  keys.ts           (신규) 조 이름 ↔ 조표 수(fifths) 단일 정의
  trackKind.ts      (신규) 현악기/음높이 악기/타악기 구분과 음높이 규칙
src/engine/notation/  (신규) 음 이름 정하기, 오선 위치, 덧줄, 임시표, 기둥 방향, 조표 배치
src/engine/layout/
  staffMetrics.ts   (신규) 트랙 높이의 단일 계산
  spacing.ts        (신규) 음 길이별 가로 간격
  pageStacker.ts    (신규) 줄 높이를 잰 뒤 페이지에 쌓기
  layoutCache.ts    (신규, R8) 마디 단위 레이아웃 재사용
src/engine/unroll/unrollScore.ts   재생 순서 계산을 상태 기계로 재작성
src/engine/audio/
  transport.ts      (신규) 재생 상태 기계(재생·정지·이동)
  audioGraph.ts     (신규) 트랙별 음량·좌우·효과 버스
  drumSynth.ts      (신규) 타악기 소리
src/io/
  fileFormat.ts     (신규) 저장 파일 봉투(envelope)와 버전별 변환
  sniffFileType.ts  (신규) 파일 종류 알아보기
  musicXml/  midi/  print/   (신규 폴더) 기존 파일을 나눠 재작성
src/store/
  history.ts        (신규, R8) 변경분(패치) 기반 실행취소
  autosave.ts       (신규, R1) 자동 저장·복구
src/app/AppErrorBoundary.tsx                (신규) 오류 방어막
src/ui/overlays/UnsavedChangesDialog.tsx    (신규) 리마스터 플레이북 §4의 이름을 그대로 사용
src/ui/overlays/RecoveryDialog.tsx          (신규)
src/ui/shell/TopToolbar.tsx, ToolbarOverflowMenu.tsx   (신규, 플레이북 §4의 이름)
src/test/fixtures/  src/test/e2e/regressions/  src/test/audio/  src/test/perf/   (신규)
```

목표 데이터 흐름은 다음과 같습니다.

```text
키·마우스·메뉴·팔레트
   → 명령 ID (keymap.ts 한 곳에서만 정의)
   → 트랜잭션: draft 수정 → 정리(붙임줄 등) → 불변식 검사
        ├ 실패: 저장하지 않고 안내 문구 ("이 변경은 악보를 망가뜨려 취소했습니다")
        └ 성공: score, revision, 실행취소 기록(변경분 + 커서 전/후)을 한 번에 저장
   → 파생 계산(캐시): 레이아웃(마디 단위) · 재생 컴파일
   → 화면(악보 SVG + 별도 오버레이 층) · 소리(트랙 버스)
   → 자동 저장(구독, 2초 지연)
```

### 3.4 설계 원칙

모든 단계에 적용하고, AI 프롬프트에도 그대로 넣습니다.

1. 악보 데이터는 `documentStore` 한 곳에만 있습니다. 화면과 소리는 악보에서 계산한 결과이며, 그 결과를 다시 악보에 써 넣지 않습니다(예: `midiPitch` 캐시 금지).
2. 모든 변경은 "명령 → 트랜잭션 하나"로 일어납니다. 트랜잭션은 불변식 검사를 통과해야 저장됩니다.
3. 다른 대상은 위치 번호가 아니라 고유 ID나 규칙으로 가리킵니다(예: 붙임줄 = "앞 음에서 이어짐").
4. 이벤트 처리 중에는 화면을 그릴 때의 값을 쓰지 않고, 스토어의 최신 값(`useDocumentStore.getState()`)을 읽습니다.
5. 같은 정의는 한 곳에만 둡니다(단축키, 높이 계산, 조표 수, 검증 규칙).
6. `src/model`, `src/engine`(출력부인 render·audio 재생 제외), `src/io`는 React·DOM·Web Audio에 의존하지 않습니다. 그래야 Node에서 테스트할 수 있습니다.
7. 커서·선택·재생 위치 같은 표시는 악보 레이아웃의 입력이 아니라 위에 겹쳐 그리는 별도 층(오버레이)입니다.
8. 결함은 재현 테스트를 먼저 만들고 고칩니다.
9. 동작하지 않는 기능은 화면에 보이지 않게 하거나 "준비 중"으로 표시합니다. 눌러도 아무 일도 없는 버튼은 두지 않습니다.
10. 파일 형식이 바뀌면 버전을 올리고, 이전 버전 파일은 계속 열 수 있게 변환합니다.

---

## 4. 공통 작업 규칙

### 4.1 한 PR의 흐름

1. 브랜치를 만듭니다. 이름은 `refactor/<단계>-<주제>` 형식입니다(예: `refactor/r2-cursor-advance`).
2. 해당 보고서 항목의 재현 테스트를 추가하고, 실패하는 것을 확인한 뒤 "알려진 결함" 표시를 붙입니다(4.2).
3. 고친 뒤 표시를 떼고, 테스트가 통과하는 것을 확인합니다.
4. 4.3의 검사 명령을 모두 통과시킵니다.
5. PR 설명에 "보고서 항목 / 바뀐 동작 / 확인 방법 / 남은 문제"를 적습니다.
6. 성태 님이 미리보기 주소에서 "직접 확인" 목록을 확인한 뒤 병합합니다.

PR 하나는 변경 파일 15개, 추가 600줄 안쪽을 권합니다. 엔진 일부를 새로 쓰는 PR(R4, R5, R6)은 예외로 하되, 새 모듈을 먼저 넣고 기존 코드와 연결하는 PR을 따로 나눕니다.

### 4.2 "알려진 결함" 테스트 방식

R0에서 보고서의 A·B 항목 30건을 모두 테스트로 만들고, 지금은 실패한다는 표시를 붙여 둡니다. 이렇게 하면 자동 검사는 계속 초록색이면서 결함 목록이 코드 안에 남습니다. 고친 PR에서 표시를 떼는 것이 "고쳤다"는 증거가 됩니다. 표시를 뗄 때가 지났는데도 남아 있으면 검사가 실패하므로 잊어버릴 수도 없습니다.

```ts
// Vitest: it.fails 는 "안쪽 검사가 실패해야 통과". 결함이 고쳐져 안쪽이 통과하면 오히려 실패로 보고된다.
it.fails("[B2] D.S. al Coda는 1 2 3 4 5 6 2 3 4 7 8 순서로 재생한다", () => {
  expect(barOrder(unrollScore(fixtures.dsAlCoda()))).toEqual([1, 2, 3, 4, 5, 6, 2, 3, 4, 7, 8]);
});
```

```ts
// Playwright: test.fail() 도 같은 의미. 예상과 달리 통과하면 실행 결과가 실패가 된다.
test("[A1] 덜 찬 마디 끝에서 →는 다음 박으로 이동한다", async ({ page }) => {
  test.fail(true, "R2에서 수정 예정");
  // ...
});
```

테스트 이름은 반드시 `[항목 ID]`로 시작합니다. 8장의 추적표가 이 이름으로 테스트를 찾습니다.

### 4.3 매 PR 필수 검사

R0에서 `package.json`에 다음 스크립트를 추가하고, 이후 모든 PR에서 실행합니다.

| 명령 | 내용 |
|---|---|
| `pnpm install --frozen-lockfile` | 잠금 파일 그대로 설치(배포와 같은 조건) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest 단위 테스트 |
| `pnpm build` | 배포용 빌드 |
| `pnpm test:e2e` | Playwright 동작 테스트(크롬) |
| `pnpm test:visual` | 화면 모양 비교. 화면을 바꾸는 PR에서만 |
| `pnpm test:audio` | 소리 측정(R5부터). 소리를 바꾸는 PR에서만 |
| `pnpm test:perf` | 성능 측정(R8부터). 엔진·화면 PR에서 권장 |
| `pnpm audit --prod` | 배포 부품 보안 경고 0건 확인 |

### 4.4 완료의 정의

PR 하나가 끝났다고 말할 수 있는 조건입니다.

- [ ] 해당 항목의 재현 테스트에서 "알려진 결함" 표시를 뗐고 통과한다.
- [ ] 4.3의 필수 검사가 모두 통과한다.
- [ ] 콘솔 오류가 없다(기존 e2e 테스트의 콘솔 오류 검사 규칙 유지).
- [ ] 새 동작에 맞게 문서를 고쳤다(README의 "알려진 한계", 해당하면 명세 문서).
- [ ] PR 설명에 확인 방법이 있고, 성태 님 확인을 받았다.
- [ ] 파일 형식을 바꿨다면 버전을 올렸고 이전 버전 파일을 여는 테스트가 있다.

### 4.5 AI에게 줄 공통 맥락 프롬프트

각 단계의 프롬프트 앞에 붙여 씁니다.

```text
[리팩토링 공통 맥락]
너는 Guitarpro8_Copy_Web_App(React 18 + TypeScript strict + Zustand + Vite)의 결함을 고치는 엔지니어다.
기준 문서: docs/refactoring/refactoring-design.md (이 설계서), 점검 보고서 항목 ID(A1~D6).

반드시 지킬 것:
1. 이번 작업의 범위는 프롬프트에 적힌 보고서 항목뿐이다. 범위 밖 파일은 고치지 않는다. 필요하면 보고만 한다.
2. 고치기 전에 해당 항목의 재현 테스트가 실패하는지 먼저 확인하고, 고친 뒤 "알려진 결함" 표시(it.fails / test.fail)를 뗀다.
3. 설계 원칙(설계서 3.4)을 지킨다. 특히: 악보 데이터에 계산 결과를 캐시하지 않는다 / 이벤트 처리 중에는 getState()로 최신 값을 읽는다 / 같은 정의를 두 곳에 만들지 않는다.
4. src/model, src/engine, src/io 에 React·DOM·Web Audio 의존을 추가하지 않는다(render·audio 출력부 제외).
5. any, 타입 단언(as unknown as) 남용, 테스트 삭제나 건너뛰기(skip)로 통과시키는 것을 금지한다.
6. 파일 형식을 바꾸면 schemaVersion을 올리고 이전 버전 변환(migration)과 테스트를 추가한다.
7. 끝나면 pnpm typecheck, pnpm test, pnpm build, pnpm test:e2e 결과를 보고한다.

완료 보고 형식:
- 고친 보고서 항목:
- 변경한 파일:
- 바뀐 동작(사용자 관점):
- 검사 결과: typecheck / test / build / e2e (PASS/FAIL)
- 남은 문제나 범위 밖에서 발견한 것:
- 커밋 메시지 제안: type(scope): message
```

### 4.6 성태 님이 하실 일

| 언제 | 하실 일 | 걸리는 시간 |
|---|---|---|
| 단계 시작 전 | 2장의 결정 확인, 프롬프트를 AI 도구에 전달 | 5분 |
| PR마다 | PR 화면의 미리보기 주소를 열고 그 단계의 "직접 확인" 목록 따라 하기 | 5~10분 |
| PR마다 | 문제가 없으면 병합 승인, 이상하면 본 것을 그대로 적어 AI에게 전달 | 2분 |
| 단계 끝 | 추적표(8장)의 해당 항목에 완료 표시 | 2분 |

미리보기 주소: Vercel이 저장소에 연결되어 있으면 PR마다 미리보기 배포가 생기고 PR 화면에 주소가 표시됩니다(이번 점검에서는 연결된 Vercel 계정에 이 앱의 프로젝트가 없어 실제 화면은 확인하지 못했습니다). 연결이 없으면 PC에서 `pnpm dev`를 실행하고 브라우저에서 `http://127.0.0.1:5173`을 엽니다.

---

## 5. 단계별 설계

각 단계는 같은 틀로 적었습니다: 목표 → 끝나면 달라지는 점 → 설계 → 작업 순서(PR) → 재현 테스트 → 완료 기준 → 직접 확인 → 위험 → AI 프롬프트.

### R0. 기반 정비

- **목표:** 배포 설치가 성공하고, 코드를 올릴 때마다 자동 검사가 돌고, 보고서의 결함이 "알려진 결함 테스트"로 기록된 상태를 만듭니다.
- **끝나면 달라지는 점:** 화면은 그대로입니다(앱 제목만 바뀜). 대신 이후 모든 수정을 자동으로 검사할 수 있게 됩니다.
- **다루는 항목:** D2, D1(PDF·표시 이름), D3, D4, D5
- **크기:** 작음(PR 3개 + main 교체)

#### 설계

**R0-1. 백업과 기준 브랜치 (결정 1)**

- 백업부터 만듭니다. `archive/main-2026-07-03` 브랜치(7cc0a5d)와 `baseline/remaster-2026-07-11` 태그(bd33397)를 만들어 GitHub에 올립니다.
- 작업 브랜치 `refactor/r0-foundation`을 remaster에서 만듭니다.
- main 교체: main과 remaster는 기록이 이어져 있지 않아 GitHub에서 일반 PR로 비교·병합할 수 없습니다. 그래서 R0의 PR들을 작업 브랜치에 모두 넣은 뒤, main을 그 끝 커밋으로 강제 교체합니다(`git push --force-with-lease origin refactor/r0-foundation:main`). 백업이 있어 되돌릴 수 있지만 **성태 님이 명시적으로 승인한 뒤에만** 실행합니다. main에 보호 규칙이 걸려 있으면 교체하는 동안만 풀어야 합니다.
- 순서가 중요합니다. main이 바뀌면 Vercel이 곧바로 배포하므로, 잠금 파일 수정(R0-2)이 들어간 상태로 교체해야 배포가 실패하지 않습니다.
- 교체 뒤 remaster 브랜치는 지우지 않고 기록용으로 둡니다. 이후 모든 PR은 main을 대상으로 합니다.

**R0-2. 설치·빌드 정상화 (D2)**

- `package-lock.json`을 지우고 pnpm 하나로 통일합니다. `package.json`에 `"packageManager": "pnpm@<로컬 버전>"`을 적습니다(이번 점검 환경은 10.28.0).
- `pnpm install`로 `pnpm-lock.yaml`을 다시 만들고, remaster에서 새로 넣은 `@playwright/test`와 `terser`가 잠금 파일에 들어갔는지 확인합니다. 깨끗한 복제본에서 `pnpm install --frozen-lockfile`이 성공해야 합니다(CI가 매번 확인).
- Node 버전 고정: `package.json`에 `"engines": { "node": "24.x" }`, 저장소에 `.nvmrc`(내용 `24`). Vercel은 `package.json`의 `engines.node`를 프로젝트 설정보다 우선해서 씁니다.
- `scripts/build.mjs`는 Node 25에서의 충돌을 피하려고 넣은 우회입니다. 성태 님 PC에서 Node 24로 `pnpm build`가 세 번 연속 성공하면 `"build": "tsc --noEmit && vite build"`로 되돌리고, `vite.config.ts`의 `minify: "terser"`도 기본값으로 되돌릴지 검토합니다(되돌리면 `terser` 의존성도 뺍니다). 실패하면 우회를 그대로 둡니다.
- `vercel.json`은 바꾸지 않습니다. 잠금 파일이 맞으면 지금 설정(`pnpm install --frozen-lockfile`)으로 설치가 성공합니다.

**R0-3. 보안 업데이트 (D4)**

2026-11-23에 remaster 기준으로 다시 확인한 `pnpm audit` 결과는 28건(중대 3, 높음 8, 보통 15, 낮음 2)입니다.

| 패키지 | 지금 | 올릴 버전 | 해결되는 경고 |
|---|---|---|---|
| vite | 6.4.3 | ^6.4.4 (같은 주 버전 안의 패치) | vite 자체 경고 전부. 높음 1건 포함 |
| vitest | 2.1.9 | ^4.1.12 (주 버전 업그레이드) | vitest·@vitest/mocker·tinypool의 중대 3건과 보통 경고. vitest 2가 따로 끌어오던 vite 5.4.21·esbuild 0.21.5도 사라짐 |
| postcss, nanoid, browserslist, source-map-js | vite 경유 | 위 두 개를 올린 뒤에도 남으면 `pnpm.overrides`로 최소 버전 지정(예: postcss ≥ 8.5.23) | 높음 경고 나머지 |

- Vitest 4는 설치된 vite를 그대로 쓰고 vite 6을 지원합니다. `vitest.config.ts`의 `environment`·`globals`·`exclude` 설정과 `tsconfig.json`의 `types: ["vitest/globals"]`가 그대로 동작하는지, 기존 테스트 91개가 통과하는지 확인합니다.
- `immer`는 지금 쓰이지 않지만 R8의 실행취소에서 쓰므로 둡니다.

**R0-4. 저장소 정리 (D1 일부, D3)**

- `git rm Guitar-Pro-8-user-guide.pdf`. 매뉴얼은 각자 PC의 `reference/` 폴더에 두고 `.gitignore`에 `reference/`를 추가합니다.
- 기획서·플레이북·`specs/`의 위치는 바꾸지 않습니다(리마스터 프롬프트가 이 경로들을 참조합니다). 이 설계서를 `docs/refactoring/refactoring-design.md`로 추가합니다.
- 표시 이름: `index.html`의 `<title>Guitar Pro Clone</title>`, `package.json`의 `name`, `nativeScore.ts`의 `createdWith`를 새 이름으로. 이름이 정해지기 전에는 "Guitar Pro"가 들어가지 않은 임시 이름을 씁니다. `lang="en"`은 화면 언어를 정할 때(R9) 함께 바꿉니다.
- `README.md`(신규): 앱 소개 한 문단, 실행 방법(`pnpm install` / `pnpm dev` / `pnpm test` / `pnpm build`), 현재 상태와 알려진 한계(보고서·이 설계서 링크), 폴더 구조, 작업 규칙(4장 요약), 사용한 글꼴·소리의 출처와 라이선스(R3·R5에서 채움).
- `LICENSE`: 성태 님이 종류를 정한 뒤 추가합니다(2.3).
- 과거 기록에서 PDF 지우기(선택): `git filter-repo --path Guitar-Pro-8-user-guide.pdf --invert-paths`로 기록을 다시 쓴 뒤 모든 브랜치를 강제 푸시합니다. 커밋 번호가 전부 바뀌어 기존 복제본은 새로 받아야 하고, 이미 누군가 받아 간 사본은 지울 수 없습니다. GitHub에 남은 옛 커밋 주소까지 지우려면 GitHub 지원 요청이 필요할 수 있습니다. 되돌리기 어려우므로 별도로 승인을 받습니다.

**R0-5. 테스트 기반 (D5)**

- 테스트용 읽기 창구: 기존 `src/test/testMode.ts`(주소에 `?testMode=visual`이 있을 때만 동작)에 `testMode=e2e`를 추가하고, 그때만 `window.__GPW_TEST__`를 만듭니다.

```ts
// src/test/testHooks.ts (신규) — testMode가 아닐 때는 아무것도 하지 않는다
interface GpwTestHooks {
  getScore(): Score;                  // structuredClone 사본
  getCursor(): CursorPosition;
  getSelection(): SelectionRange | null;
  getPlayback(): { status: string; positionSec: number };
  getRevision(): { revision: number; savedRevision: number | null };
  loadScoreJson(json: string): void;  // 픽스처를 여는 테스트 전용 입구
}
```

- 시험용 악보 `src/test/fixtures/`(신규): 짧은 빌더로 만듭니다(예: `scoreBuilder().timeSignature(4, 4).bars(8).masterBar(2, { directionTargets: ["Segno"] })`). 필요한 픽스처는 `emptyGuitar(bars)`, `quarterRun`, `tieAcrossBeat`, `tieAcrossBarline`, `dsAlCoda`, `voltaTwoBarFirstEnding`, `threeFour`, `tempoRamp`, `drumsBasic`, `chordsAndRests`, `eightTracks`, `big100x8`(생성기)입니다. MusicXML·MIDI 픽스처는 R6에서 추가합니다.
- 알려진 결함 테스트(4.2): Vitest는 모듈 옆의 `*.regressions.test.ts`(예: `src/engine/unroll/unrollScore.regressions.test.ts`), Playwright는 `src/test/e2e/regressions/*.spec.ts`. 기존 e2e의 "콘솔 오류가 나면 실패" 자동 검사를 그대로 씁니다.
- 공용 도우미 `src/test/e2e/helpers.ts`(신규): `openApp(page, { fixture })`, `focusScore(page)`, `typeKeys(page, "5 ArrowRight 7")`, `state(page)`(`__GPW_TEST__` 읽기).

**R0-6. 자동 검사(CI) (D5)**

- `.github/workflows/ci.yml`(신규), push와 PR마다 실행합니다. 작업 `check`(ubuntu-latest): 저장소 받기 → pnpm 준비(`packageManager` 버전) → Node 준비(`.nvmrc`, pnpm 캐시) → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm exec playwright install --with-deps chromium` → `pnpm test:e2e` → 실패하면 `playwright-report/`, `test-results/`를 결과물로 올림.
- 화면 비교 테스트: 지금 기준 이미지는 Windows에서 만든 것(`*-win32.png`)이라 Linux CI에서는 비교할 수 없습니다. Playwright 공식 Docker 이미지 안에서 도는 `visual` 작업을 따로 두고, Linux 기준 이미지는 수동 실행 워크플로(`workflow_dispatch`)로 만들어 결과물로 올린 뒤 사람이 차이를 보고 승인해서 커밋합니다. 그 전까지 화면 비교는 로컬에서만 돌립니다.
- 주 1회 `audit` 작업: `pnpm audit --audit-level=high`.
- GitHub 설정(성태 님): main에 "check 통과 필수" 규칙을 거는 것을 권합니다. 저장소 Settings → Branches(또는 Rules) 메뉴에서 main 규칙을 추가하고 상태 검사 `check`를 필수로 지정합니다. 이 화면은 제가 직접 확인하지 못했습니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R0-a | 잠금 파일·Node 고정·스크립트·보안 업데이트(R0-2, R0-3) |
| R0-b | PDF 제거·표시 이름·README·설계서 추가(R0-4) |
| R0-c | 테스트 창구·픽스처·알려진 결함 테스트·CI(R0-5, R0-6) |
| 교체 | 성태 님 승인 후 main을 작업 브랜치로 교체(R0-1) |

#### 완료 기준

- [ ] 깨끗한 복제본에서 `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`가 통과한다.
- [ ] GitHub Actions의 `check`가 초록색이다.
- [ ] Vercel 미리보기 배포가 성공한다(설치 단계 통과).
- [ ] `pnpm audit`에 중대·높음이 없다.
- [ ] 저장소 최신 상태에 매뉴얼 PDF가 없다.
- [ ] A·B 항목 30건 각각에 `[ID]`로 시작하는 알려진 결함 테스트가 있고, 8장 추적표와 일치한다.

#### 직접 확인

1. GitHub 저장소 → Actions 탭 → 가장 최근 실행에 초록색 체크가 있는지 봅니다.
2. PR 화면의 미리보기 주소를 엽니다 → 앱이 지금과 똑같이 뜨는지(제목만 바뀜) 봅니다.
3. 저장소 첫 화면에 `Guitar-Pro-8-user-guide.pdf`가 없고 README 내용이 보이는지 봅니다.
4. main 교체 승인 요청을 받으면, 브랜치 목록에 `archive/main-2026-07-03`이 있는지 먼저 확인한 뒤 승인합니다.

#### 위험과 되돌리기

| 위험 | 대응 |
|---|---|
| main 교체를 잘못함 | 백업으로 되돌림: `git push --force-with-lease origin archive/main-2026-07-03:main` |
| Vitest 4 업그레이드로 기존 테스트가 깨짐 | R0-a 안에서 고침. 시간이 걸리면 일단 3.2.6 이상(중대 경고만 해결)으로 올리고 나머지는 다음 PR |
| 성태 님 PC에서 Node 24로도 빌드 충돌 | `build.mjs` 우회를 유지하고 다른 단계를 진행 |

#### AI 프롬프트 (R0)

```text
[R0 기반 정비]  ※ 4.5의 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 D2, D1(PDF·표시 이름), D3, D4, D5. 앱 동작은 바꾸지 않는다.
먼저 읽을 것: package.json, pnpm-lock.yaml, pnpm-workspace.yaml, vercel.json, scripts/build.mjs,
  vite.config.ts, vitest.config.ts, playwright.config.ts, src/main.tsx, src/test/testMode.ts,
  src/test/e2e/editor-shell.spec.ts, 설계서 4장·8장.
PR R0-a:
 1. package-lock.json 삭제. packageManager, engines.node "24.x", .nvmrc 추가. pnpm install로 잠금 파일 재생성.
    깨끗한 복제본에서 pnpm install --frozen-lockfile 성공을 확인한다.
 2. vite ^6.4.4, vitest ^4.1.12로 올리고 마이그레이션한다. 남는 high 이상 경고는 pnpm.overrides로 해결한다.
    올리기 전후의 pnpm audit 요약을 PR에 붙인다.
 3. scripts에 typecheck, check(typecheck+test+build), preview, test:audio, test:perf(자리만) 추가.
PR R0-b:
 4. Guitar-Pro-8-user-guide.pdf를 git rm, .gitignore에 reference/ 추가. README.md 작성.
    index.html title, package.json name, nativeScore.ts createdWith를 "<임시 앱 이름>"으로 바꾼다.
    설계서를 docs/refactoring/refactoring-design.md로 추가한다.
PR R0-c:
 5. src/test/testHooks.ts(설계서 R0-5의 인터페이스)와 testMode=e2e. 제품 경로(쿼리 없음)에서는
    window.__GPW_TEST__가 생기지 않음을 테스트로 확인한다.
 6. src/test/fixtures/ 빌더와 설계서 R0-5의 픽스처, src/test/e2e/helpers.ts.
 7. 설계서 8장 추적표의 A·B 항목마다 [ID]로 시작하는 재현 테스트를 만들고 it.fails / test.fail 표시.
    표시를 잠시 떼고 실제로 실패하는 것을 확인한 결과를 PR에 남긴다.
 8. .github/workflows/ci.yml의 check 작업.
금지: 기능 코드 수정, 기존 테스트 삭제·skip, 화면 비교 기준 이미지 갱신, main 강제 푸시(사람이 직접 한다).
```

### R1. 작업물 보호와 파일 안전

- **목표:** 어떤 경우에도 작업이 말없이 사라지거나 흰 화면이 되지 않게 합니다.
- **끝나면 달라지는 점:**
  - 오류가 나도 흰 화면 대신 "되돌리기 / 자동 저장본 복구 / 새로 고침"을 고르는 창이 뜹니다.
  - 2초마다 브라우저 안에 자동 저장되고, 다시 열면 복구할지 묻습니다.
  - 저장하지 않고 닫거나 다른 파일을 열려 하면 확인 창이 뜹니다.
  - 저장하면 "Unsaved changes"와 탭의 ● 표시가 사라집니다.
  - 저장한 파일을 다시 열고 트랙을 추가해도 트랙이 꼬이지 않습니다.
  - 실제 Guitar Pro 파일을 열면 이해할 수 있는 안내가 나옵니다.
- **다루는 항목:** A9, A10, A11, B16, D1(확장자)
- **크기:** 중간(PR 4개). 앱 이름·확장자가 정해지지 않았으면 R1-d만 미루고 a~c를 먼저 합니다.

#### 설계

**R1-1. 트랜잭션 관문과 불변식 (A9의 근본 대책)**

불변식은 "악보가 언제나 지켜야 하는 조건"입니다. 지금은 이 검사가 없어서, 잘못된 편집이 그대로 저장되었다가 그리는 순간 오류가 나며 화면 전체가 멈춥니다.

```ts
// src/model/invariants.ts (신규)
export type InvariantSeverity = "fatal" | "warning";
export interface InvariantIssue {
  code: string;                 // 예: "string-range"
  severity: InvariantSeverity;
  message: string;              // 사용자에게 보여 줄 한 문장
  location?: { trackId?: string; barIndex?: number; voiceIndex?: number; beatIndex?: number };
}
export function checkInvariants(score: Score): InvariantIssue[];
```

| 코드 | 수준 | 조건 |
|---|---|---|
| `bars-count` | fatal | 모든 트랙의 `bars.length === masterBars.length` |
| `voices-count` | fatal | 마디마다 voice가 4개 |
| `track-id-unique` | fatal | 트랙 ID가 비어 있지 않고 서로 다름 |
| `string-range` | fatal | 현악기 트랙의 음이 `1 ≤ string ≤ tuning.strings.length` |
| `fret-range` | fatal | `0 ≤ fret ≤` 악기 정의의 최대 프렛(정의가 없으면 24) |
| `string-collision` | fatal | 한 박 안에 같은 줄의 음이 두 개 이상 없음 |
| `duration-valid` | fatal | duration ∈ {1,2,4,8,16,32,64}, dots ∈ {0,1,2}, 잇단음 n·m이 양의 정수 |
| `bar-length` | warning | 마디 실제 길이 ≠ 박자표 길이. 편집 중 잠시 생길 수 있어 막지 않고 빨간 마디로 표시 |
| `automation-range` | warning | 자동화 지점이 곡 길이 밖 |

R2 이후 `tie-orphan`(이어질 앞 음이 없는 붙임줄, warning), R4 이후 `drum-midi`(타악기 음에 `midiNumber` 필수, fatal)를 추가합니다.

- `documentStore.transact`(55~69행)를 바꿉니다. `recipe(after)` 다음에 `checkInvariants(after)`를 실행해서 fatal이 있으면 저장하지 않고 `lastRejection = { label, issues }`만 남깁니다. 화면에는 "이 변경은 악보를 망가뜨려 취소했습니다: (사유)"를 짧게 띄웁니다. 검사는 음표 수에 비례하므로 큰 악보에서도 수 ms 수준이어야 하고, R8에서 측정합니다.
- 관문을 지나 들어온 이상한 데이터가 있어도 화면이 멈추지 않도록, `derive.ts`에 `tryNoteMidiPitch(note, track): number | null`을 추가해 그리기·재생 경로에서 씁니다. 오류를 던지는 `stringPitch`는 편집 경로에서만 씁니다.

**R1-2. 오류 방어막 (A9)**

- `src/app/AppErrorBoundary.tsx`(신규): React의 오류 경계(`componentDidCatch`) 컴포넌트로 편집기 전체를 감쌉니다. 대체 화면의 버튼은 네 가지입니다.
  1. "마지막 변경 취소하고 계속": `undo()` 실행 뒤 방어막을 초기화
  2. "자동 저장본에서 복구": R1-4의 복구 창
  3. "오류 정보 복사": 오류 메시지, 스택, 앱 버전, 최근 실행한 명령 이름 20개(악보 내용은 넣지 않음)
  4. "새로 고침"
- 전역 오류(`error`, `unhandledrejection`)는 짧은 안내만 띄우고 앱은 계속 동작합니다.
- 재현된 두 경로는 원인도 직접 고칩니다.
  - 튜닝 창에서 줄 수 줄이기(`TrackSystemPanels.tsx`): 없어지는 줄에 음이 있으면 "6번 줄에 음 N개가 있습니다 — [다른 줄로 옮기기] [삭제] [취소]" 창을 띄웁니다. "옮기기"는 같은 음높이를 낼 수 있는 다른 줄을 찾고(`instruments.ts`의 배치 함수), 못 찾은 음은 개수를 알려 준 뒤 지웁니다. 줄 수가 줄어드는 경우에는 `retuneTrack`의 `"keep-fingering"` 모드를 허용하지 않습니다.
  - ASCII 가져오기(`importAsciiTab`): 빈 줄로 나뉜 줄 묶음(시스템) 단위로 읽어 마디를 이어 붙입니다. 묶음마다 줄 수가 같아야 하고, 다르면 "3번째 묶음의 줄 수가 다릅니다"라고 알려 줍니다. 줄 수가 3~10을 벗어날 때도 같은 방식으로 안내합니다.

**R1-3. 저장 상태 표시 (A10 일부)**

- `documentStore`에 `revision`(저장할 때마다 1씩 늘어나는 번호)과 `savedRevision`(마지막으로 저장하거나 연 시점의 번호)을 둡니다. `dirty = revision !== savedRevision`으로 계산합니다.
- 실행취소 기록에 `revisionBefore`·`revisionAfter`를 함께 저장합니다. 실행취소로 저장 시점에 돌아가면 다시 "저장됨"이 됩니다. 지금은 `undoStack.length > 1`로 어림하고 있습니다.
- `markSaved()`: `useFileController.ts`의 저장 경로에서 호출합니다. 파일 시스템 접근 API로 저장할 때는 쓰기가 끝난 뒤, 내려받기 방식일 때는 내려받기를 시작한 뒤 호출합니다(브라우저가 완료를 알려 주지 않습니다).
- 탭의 ●와 "Unsaved changes" 표시는 오직 `dirty`로 계산합니다.

**R1-4. 덮어쓰기 확인·닫기 경고·자동 저장 (A10)**

- `src/ui/overlays/UnsavedChangesDialog.tsx`(신규): "저장하지 않은 변경이 있습니다 — [저장 후 계속] [저장하지 않고 계속] [취소]".
- `useFileController.ts`에 `confirmDiscardIfDirty(): Promise<boolean>`을 만들고 `handleNewFile`, `handleOpenNativeFile`, `handleFileInputChange`(가져오기), `handleScoreDrop`(끌어다 놓기), 데모 열기 앞에서 호출합니다.
- 닫기 경고: `dirty`일 때만 `beforeunload`를 등록합니다. 경고 문구는 브라우저가 정한 기본 문구로 나옵니다.
- 자동 저장 `src/store/autosave.ts`(신규)

| 항목 | 설계 |
|---|---|
| 저장소 | IndexedDB. 키 `doc:<documentId>` → `{ documentId, title, savedAt, revision, schemaVersion, payload }`. `idb-keyval`(Apache-2.0)을 쓰거나 직접 구현 |
| 시점 | `revision`이 바뀐 뒤 2초 동안 추가 변경이 없을 때. 탭이 가려질 때(`visibilitychange` → hidden)와 `pagehide` 때는 즉시 |
| 보관 | 문서마다 최신 1개, 전체 최근 10개. 넘치면 오래된 것부터 삭제 |
| 시작할 때 | 명시적 저장보다 새 자동 저장본이 있으면 `RecoveryDialog`(신규): 곡 제목, 저장 시각, [복구] [버리기] [나중에]. 지금처럼 데모를 자동으로 여는 동작(`App.tsx` 66~71행)은 이 확인 뒤에만 |
| 문서 ID | 새 문서나 파일을 열 때 `newId("doc")`를 발급하고 저장 파일에 기록. 같은 파일을 다시 열면 같은 ID |
| 쓸 수 없는 환경 | IndexedDB를 쓸 수 없으면(일부 사생활 보호 모드 등) 자동 저장을 끄고 상단에 "자동 저장을 쓸 수 없는 환경입니다"를 표시 |

**R1-5. 고유 ID (A11)**

```ts
// src/model/ids.ts (신규)
export type IdKind = "doc" | "trk";
export function newId(kind: IdKind): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8)); // 브라우저와 Node 모두 지원
  const body = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
  return `${kind}_${body}`;
}
```

- `factory.ts`의 모듈 변수 `nextTrackId`(66행)를 없애고 `createTrack`에서 `newId("trk")`를 씁니다. 기존 파일의 `track-1` 같은 ID는 그대로 유효합니다.
- 파일을 열 때 `ensureUniqueTrackIds(score)`를 실행합니다. 중복이 있으면 새 ID를 주고, 그 ID를 쓰는 곳(R2 전까지의 붙임줄 `NoteRef.trackId`, 믹서 설정의 키, 커서)을 함께 바꿉니다.

**R1-6. 저장 파일 봉투 v2와 형식 판별 (B16, D1)**

```ts
// src/io/fileFormat.ts (신규)
export const APP_FILE_FORMAT = "<앱 식별자>/score";   // 앱 이름이 정해지면 확정
export const NATIVE_EXTENSION = ".<확장자>";          // 앱 이름이 정해지면 확정
export const CURRENT_SCHEMA_VERSION = 2;

export interface ScoreFileEnvelope {
  format: typeof APP_FILE_FORMAT;
  schemaVersion: number;
  app: { name: string; version: string };
  documentId: string;
  savedAt: string; // ISO 8601
  score: Score;
}

export function readScoreFile(text: string): { score: Score; documentId: string; warnings: string[] };
export function writeScoreFile(score: Score, documentId: string): string; // 들여쓰기 없이 저장
```

- 읽는 순서: JSON 해석 → 봉투 판별(새 봉투 / v1 봉투 `guitar-pro-clone/native-score` / 봉투 없는 Score) → `migrations[n]`을 현재 버전까지 차례로 적용 → zod로 구조 검사 → 빠진 필드에 기본값 채우기 → `checkInvariants`(fatal이면 열지 않고 사유를 보여 줌).
- v1 → v2 변환: 봉투 교체, `documentId` 발급, `ensureUniqueTrackIds`, 마디 수 맞추기. 지금 `nativeScore.ts`의 `normalizeScoreForIo`는 모자란 마디를 "마지막 마디 복사"로 채워 음표까지 복제하므로, 빈 마디(온쉼표)로 채우도록 바꿉니다.
- 파일 종류 판별 `src/io/sniffFileType.ts`(신규): 파일 앞부분 바이트로 판단합니다.

| 파일 앞부분 | 판별 | 처리 |
|---|---|---|
| `{` (앞 공백·BOM 무시) | 이 앱의 JSON | 위 읽기 순서 |
| `PK` 03 04 (ZIP) | 이름이 `.mxl`이거나 안에 `META-INF/container.xml`이 있으면 압축 MusicXML(R6), 아니면 Guitar Pro 7·8 | GP면 안내 문구 |
| `BCFS` 또는 `BCFZ` | Guitar Pro 6(.gpx) | 안내 문구 |
| 두 번째 바이트부터 `FICHIER GUITAR PRO` | Guitar Pro 3~5 | 안내 문구 |
| `MThd` | MIDI | MIDI 가져오기 |
| `<?xml` 또는 `<score-partwise` | MusicXML | MusicXML 가져오기 |
| 그 밖의 글자 | ASCII 탭 후보 | ASCII 가져오기 |

- 안내 문구 예: "Guitar Pro 파일은 아직 직접 열 수 없습니다. Guitar Pro의 내보내기 기능으로 MusicXML 파일을 만든 뒤, 이 앱의 '가져오기 → MusicXML'로 열어 주세요."
- 저장은 `NATIVE_EXTENSION`으로 합니다. 열기 창은 `NATIVE_EXTENSION`, 예전 `.gp`(이 앱이 저장한 JSON), `.json`을 모두 받습니다. 예전 `.gp`를 열면 "새 확장자로 다시 저장해 주세요"를 한 번 알려 줍니다.
- `useFileController.ts`에 `.gp`가 직접 적힌 13곳(예: 92·131·338·354행)을 모두 상수로 바꿉니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R1-a | 불변식, 트랜잭션 관문, `tryNoteMidiPitch`(R1-1) |
| R1-b | 오류 방어막, 튜닝 줄 수 확인 창, ASCII 여러 묶음 읽기(R1-2) |
| R1-c | revision 기반 저장 상태, 확인 창, 닫기 경고, 자동 저장, 복구 창(R1-3, R1-4) |
| R1-d | 고유 ID, 파일 봉투 v2, 형식 판별, 확장자 상수(R1-5, R1-6) |

#### 재현 테스트

- `[A9]` 6줄 트랙을 5줄로 바꿔도 화면이 유지되고 확인 창이 뜬다 / 두 묶음짜리 ASCII 탭을 가져오면 6줄 트랙에 마디가 이어진다
- `[A10]` 변경이 있을 때 New → 확인 창 / 저장 후 dirty가 아니다 / 변경이 있을 때 `beforeunload`가 등록된다 / 새로 고침 후 복구 창에서 복구하면 같은 악보다
- `[A11]` 저장 → 새로 고침 → 열기 → 트랙 추가 → 모든 트랙 ID가 다르고, 새 트랙을 선택해 입력할 수 있다
- `[B16]` ZIP으로 시작하는 `.gp` → 안내 문구, 앱 유지 / 저장 파일 확장자가 `NATIVE_EXTENSION`
- 추가 단위 테스트: 불변식을 어기는 편집은 저장되지 않는다 / v1 파일이 v2로 열린다 / 깨진 JSON은 사유를 보여 준다

#### 완료 기준

- [ ] 위 테스트가 통과하고 알려진 결함 표시를 뗐다.
- [ ] 100마디×8트랙에서 자동 저장이 입력을 멈추게 하지 않는다(저장 중 입력 지연 100ms 미만).
- [ ] 예전 `.gp`(이 앱 형식) 파일과 데모가 그대로 열린다.

#### 직접 확인

1. 미리보기를 열고 음을 하나 입력한 뒤 브라우저 탭을 닫아 봅니다 → 나가기 확인이 뜨는지 봅니다.
2. 다시 열면 "복구할 작업이 있습니다" 창이 뜨는지, [복구]를 누르면 입력한 음이 있는지 봅니다.
3. 음을 입력하고 Ctrl+N → 확인 창이 뜨는지, [취소]를 누르면 악보가 그대로인지 봅니다.
4. Ctrl+S로 저장 → 탭의 ● 표시가 사라지는지 봅니다.
5. 저장한 파일을 다시 열고 `+ Track`으로 트랙을 추가 → 새 트랙을 클릭하고 숫자를 눌러 새 트랙에 음이 들어가는지 봅니다.
6. 실제 Guitar Pro 파일이 있으면 악보 위로 끌어다 놓아 안내 문구가 나오는지 봅니다.
7. 튜닝 창에서 6줄 트랙을 5줄로 바꿔 → 확인 창이 뜨고 흰 화면이 되지 않는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| 큰 악보에서 자동 저장 직렬화가 느림 | `requestIdleCallback`으로 쉬는 시간에 실행. R8의 압축 형식으로 추가 개선 |
| 불변식이 정상 편집까지 막음 | fatal은 위 표의 항목만. 새 fatal 추가는 설계 변경으로 취급 |
| 확장자 이름 미정 | R1-d만 뒤로 미룸 |

#### AI 프롬프트 (R1)

```text
[R1 작업물 보호와 파일 안전]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 A9, A10, A11, B16. 설계서 R1-1 ~ R1-6. PR 4개(R1-a ~ R1-d)로 나눈다.
먼저 읽을 것: src/store/documentStore.ts, src/model/derive.ts, src/model/factory.ts,
  src/model/instruments.ts(retuneTrack), src/io/nativeScore.ts, src/io/asciiTab.ts, src/app/App.tsx,
  src/app/controllers/useFileController.ts, src/ui/shell/TrackSystemPanels.tsx, src/main.tsx
R1-a: src/model/invariants.ts(설계서 표의 fatal/warning 그대로), documentStore.transact에 관문,
      거부 시 짧은 안내. derive.ts에 tryNoteMidiPitch를 만들고 layout·compile 경로에서 사용.
R1-b: AppErrorBoundary(버튼 4개), 전역 오류 안내, 튜닝 줄 수 감소 확인 창(옮기기/삭제/취소),
      importAsciiTab을 줄 묶음 단위로 읽기.
R1-c: revision/savedRevision/markSaved, UnsavedChangesDialog + confirmDiscardIfDirty
      (New/Open/Import/Drop/Demo), dirty일 때만 beforeunload, src/store/autosave.ts(IndexedDB,
      2초 지연, 최근 10개), RecoveryDialog, 데모 자동 열기는 복구 확인 뒤로.
R1-d: src/model/ids.ts, factory의 nextTrackId 제거, ensureUniqueTrackIds, src/io/fileFormat.ts
      (봉투 v2, migrations, zod 검사, 기본값 채우기), src/io/sniffFileType.ts, .gp 하드코딩 13곳을
      NATIVE_EXTENSION 상수로. 확장자 값은 "<확장자>" 자리표시자와 TODO 주석으로 둔다.
각 PR에서 해당 [A9]/[A10]/[A11]/[B16] 테스트의 알려진 결함 표시를 뗀다.
금지: 레이아웃·오선보·재생 로직 변경, 불변식 fatal 목록 임의 추가.
```

### R2. 입력 흐름

- **목표:** 키보드 입력의 기본 흐름(→ 이동, 숫자, 단축키, 붙임줄, 마디 추가)을 바로잡습니다.
- **끝나면 달라지는 점:**
  - 5, →, 7, →, 8을 치면 세 음이 차례로 들어갑니다. 빨리 쳐도 숫자가 합쳐지지 않습니다.
  - 악보 끝에서 →를 누르면 새 마디가 생기고 커서가 그 마디로 넘어갑니다.
  - `Shift+.`(점음표), `Shift+/`(셋잇단), `$`(슬랩), `|`(free time)가 동작하고 "Unknown command" 오류가 사라집니다. 한글 입력 상태에서도 글자 단축키가 동작합니다.
  - `Ctrl+=`, `Ctrl+-`는 확대·축소만 합니다.
  - 처음 열었을 때와 버튼을 누른 뒤에도 키 입력이 악보로 갑니다. `Ctrl+Z`가 어디서나 동작합니다.
  - 3/4 곡에 마디를 추가하면 3/4 마디가 생기고, 박자·조를 바꾸면 다음 변경 지점까지 적용됩니다.
  - 붙임줄로 이은 음이 하나의 긴 음으로 재생되고, 마디를 넣거나 음을 지워도 엉뚱한 음과 이어지지 않습니다.
- **다루는 항목:** A1, A2, B1, B10, B12, C13, D6(단축키 정의 통합)
- **크기:** 중간(PR 5개)

#### 설계

**R2-1. 커서 이동 (A1)**

- 원인: `useEditorController.ts`의 `moveCursor`(281~291행)는 마디를 늘리는 이동에서 트랜잭션 안에서 계산한 커서를 `updateCursorSelection`에 넘깁니다. 그런데 `updateCursorSelection`(179~181행)이 이것을 다시 `normaliseCursor(score, …)`로 정규화하고, 이때의 `score`는 화면을 그릴 때의 값(수정 전 악보)입니다. 그래서 새로 생긴 박이나 마디가 "없는 것"으로 판단되어 커서가 되돌아갑니다.
- 변경:
  1. `updateCursorSelection(nextCursor, extend)`는 정규화하지 않고 받은 커서를 그대로 씁니다. 정규화는 호출하는 쪽에서 최신 악보(트랜잭션이 돌려준 악보 또는 `useDocumentStore.getState().score`)로 한 번만 합니다.
  2. 악보를 바꾸는 이동은 모두 `editWithCursor`(170~177행) 한 경로로 합칩니다.
  3. 실행취소 기록에 `cursorBefore`·`cursorAfter`를 함께 저장하고, 실행취소·다시실행 때 커서도 되돌립니다. 커서의 주인은 리마스터 플레이북 §4.1대로 `viewStore`이고, 기록에는 사본만 둡니다.
  4. 같은 실수를 막는 규칙: 이벤트 처리 함수 안에서는 컴포넌트가 받은 `score`를 읽지 않습니다(설계 원칙 4). PR 체크 항목에 넣습니다.

**R2-2. 숫자 입력 (A2)**

- 지금: 첫 숫자를 0.3초 동안 버퍼에 담았다가 넣습니다(`editorKeymap.ts`의 `handleNumericInput`, 40~73행). 버퍼에 숫자가 남아 있는 동안 →가 먼저 처리되면, 다음 숫자가 버퍼에 붙어 "57"이 됩니다.
- 새 방식: "기다렸다 넣기"를 없앱니다.
  1. 숫자를 누르면 그 프렛을 바로 넣습니다.
  2. 0.3초 안에 같은 위치에서 둘째 숫자가 오고, 두 자리 값이 그 악기의 최대 프렛 이하이면 방금 넣은 음을 두 자리 값으로 바꿉니다. 이 변경은 실행취소 기록의 직전 항목과 합쳐 한 단계로 만듭니다.
  3. 숫자가 아닌 키를 누르거나 커서가 움직이면 두 자리 대기는 바로 끝납니다.
- 이렇게 하면 "입력 대기" 상태 자체가 없어져 다른 키와 순서가 꼬일 수 없습니다.

| 입력 | 결과 |
|---|---|
| `1`, `2`를 빠르게 | 12 |
| `1`, 0.5초 뒤 `2` | 2로 덮어씀 |
| `3`, `5`를 빠르게(최대 24프렛) | 35는 불가능하므로 5로 덮어씀 |
| `5`, →, `7`을 빠르게 | 첫 박 5, 둘째 박 7 |

**R2-3. 단축키 (B12, D6)**

- 정의는 `src/commands/keymap.ts`의 `KEYMAP_ENTRIES` 한 곳만 남깁니다. `registry.ts`의 `Command.shortcut` 필드와 `shortcuts.ts`의 별도 해석기는 없애고, 화면에 보여 줄 단축키 이름은 `shortcutLabel(commandId)`로만 얻습니다.
- 명령 ID에 타입을 붙입니다. 명령을 정의하는 모듈이 ID 목록을 `as const`로 내보내고 `type CommandId`를 만들어, 키맵·메뉴·팔레트가 이 타입만 받게 합니다. 등록되지 않은 ID를 적으면 빌드가 실패합니다. 실행 시점에도 "앱이 명령을 모두 등록한 뒤 키맵의 모든 ID가 등록되어 있다"는 단위 테스트를 둡니다.
- 키 판정 규칙을 바꿉니다(`isKeymapEventMatch`, 253행부터). `KeymapEventLike`에 `code`를 추가합니다.

| 단축키 종류 | 판정 기준 | 이유 |
|---|---|---|
| 글자·숫자(`G`, `T`, `1`) | `event.code`(`KeyG`, `Digit1`) + 수정 키가 정확히 일치 | 한글 입력 상태에서는 `event.key`가 "ㅎ" 같은 한글로 옴 |
| 기호(`$`, `\|`, `<`, `>`, `+`, `/`) | `event.key` + Ctrl·Alt·Meta만 일치(Shift는 보지 않음) | 기호는 이미 Shift가 반영된 결과. 지금 `$`와 `\|`는 `shiftedGlyphs` 목록(54행)에 없어 판정에 실패함 |
| Shift를 명시한 기호(`Shift+.`, `Shift+/`) | `event.code`(`Period`, `Slash`) + Shift | 자판 배치와 관계없이 물리 키로 판정 |
| 이름 키(`ArrowLeft`, `Delete`, `Space`) | `event.key` | 지금과 같음 |
| 입력기 처리 중(`event.key === "Process"` 또는 `isComposing`) | `event.code` | 조합 중 이벤트도 물리 키로 판정 |

- 충돌 검사 단위 테스트: 모든 항목을 "미국·한국 자판에서 실제로 누르는 물리 키 조합"으로 바꾼 뒤, 같은 범위(scope) 안에서 두 명령이 같은 조합이면 실패시킵니다. 이 테스트가 `Shift+.`(점음표)와 `>`(Fade Out)의 충돌을 잡아냅니다. 2.2의 결정대로 점음표를 남기고, Fade Out은 메뉴·팔레트로만 실행합니다.
- `editorKeymap.ts`의 `commandIdForEvent`(75~85행)는 `+`, `=`, `-`를 수정 키 없이 눌렀을 때만 음 길이 명령으로 바꿉니다. 지금은 Ctrl 여부를 보지 않아 `Ctrl+=`(확대)가 음 길이도 바꿉니다.
- 등록되지 않은 단축키 20개(`G`, `T`, `K`, `W`, `Shift+H`, `Shift+P`, `Ctrl+R`, `Ctrl+Enter` 등): 위 단위 테스트가 목록을 뽑아 줍니다. 항목마다 "지금 구현(간단하고 기획에 있음)" 또는 "키맵에서 빼고 미구현 목록으로 이동"을 정해 PR 설명에 표로 남깁니다.
- 포커스
  - 앱을 열면 악보 영역(`.scoreViewport`, `tabIndex=0`)에 포커스를 줍니다.
  - 도구줄·팔레트 버튼은 마우스로 누를 때 포커스를 가져가지 않게 합니다(`onMouseDown`에서 `preventDefault`). 키보드 Tab 이동은 그대로 됩니다.
  - 대화창·팝오버가 닫히면 포커스를 원래 자리(대개 악보)로 돌려줍니다.
  - `Ctrl+Z`, `Ctrl+Y`, `Ctrl+S`, `Ctrl+O`, `Ctrl+N`, `Space` 같은 전역 단축키는 `useGlobalShortcuts.ts`의 `window` 처리기 하나에서 받습니다. 입력란(input, textarea, select, contenteditable)에 포커스가 있으면 Escape 말고는 넘기지 않습니다.

**R2-4. 새 마디와 박자·조의 적용 범위 (B10)**

- 새 마디(`insertBarAtCursor`, `appendBarToAllTracks`)는 바로 앞 마디(맨 앞에 넣을 때는 뒤 마디)의 박자표·조표·셋잇단 느낌(`tripletFeel`)을 물려받습니다. 도돌이표, 구간 표시, 코다·세뇨, 늘임표, 다른 괄호(alternate endings), 겹세로줄, 줄바꿈 설정은 물려받지 않습니다. 트랙의 새 마디는 박자 길이만큼의 쉼표로 채웁니다.
- 박자·조를 바꿀 때 적용 범위를 둡니다.

```ts
// src/engine/editing/operations.ts
export type SignatureScope = "untilNextChange" | "thisBarOnly" | "toEnd";
export function setTimeSignature(score: Score, fromBar: number, ts: TimeSignature, scope: SignatureScope): void;
export function setKeySignature(score: Score, fromBar: number, key: KeySignature, scope: SignatureScope): void;
// untilNextChange: old = masterBars[fromBar]의 값. fromBar부터 값이 old와 같은 마디가 이어지는 동안 새 값으로 바꾼다.
```

- 기본은 `untilNextChange`입니다. 지금의 `cycleTimeSignatureAtCursor`·`cycleKeySignatureAtCursor`(489·512행)도 이 함수를 쓰게 합니다. 박자를 바꿔 길이가 맞지 않게 된 마디는 자동으로 고치지 않고 `bar-length` 경고(빨간 마디)로 보여 줍니다. 범위를 고르는 대화창은 리마스터 때 붙이고, 이번에는 엔진 함수와 기본 동작만 바꿉니다.

**R2-5. 마디를 넣고 지울 때 자동화 지점 옮기기 (C13)**

- 자동화(템포·볼륨·좌우) 지점은 곡 처음부터의 절대 틱으로 저장됩니다(`AutomationPoint.tick`). 마디를 넣으면 넣은 위치 뒤의 지점을 넣은 길이만큼 뒤로 옮기고, 지우면 지운 범위 안의 지점은 없애고 뒤의 지점을 앞으로 당깁니다. 지운 범위 직전의 값이 끊기지 않도록, 필요하면 범위 시작 위치에 지점 하나를 남깁니다. 트랙 자동화와 마스터 자동화에 모두 적용합니다.

**R2-6. 붙임줄 (B1) — 데이터 형식 v3**

- 지금: 음마다 `tieOrigin`·`tieDestination`(마디·박·음 번호를 담은 `NoteRef`)을 저장합니다. `L` 명령(`tieCurrentNoteToNext`, 350행)은 "다음 박"과 잇고, 마지막 박에서는 자기 자신과 이어 무음이 됩니다. 재생(`compile.ts` 151행)은 이어진 음을 건너뛰기만 하고 원래 음을 늘리지 않습니다. 마디를 넣거나 음을 지우면 번호가 어긋납니다.
- 새 방식: 음에 `tiedFromPrevious: boolean` 하나만 저장합니다. 뜻은 "같은 성부에서 바로 앞 박의 같은 줄 음에서 이어진다"로, 명세(spec 02)의 "직전 노트에 연결, 길이 연장"과 같습니다. 상대 음은 저장하지 않고 필요할 때 찾습니다.

```ts
// src/model/ties.ts (신규)
export interface NotePath { trackId: string; barIndex: number; voiceIndex: number; beatIndex: number; noteIndex: number }

/** 같은 트랙·성부에서 바로 앞 박(마디 경계를 넘어도 됨)의 같은 줄 음.
 *  앞 박이 쉼표이거나 그 줄에 음이 없으면 null. */
export function findTieOrigin(score: Score, path: NotePath): NotePath | null;

/** 트랜잭션마다 실행: 이어진 음의 프렛을 원래 음과 같게 맞추고,
 *  원래 음이 없는 붙임줄은 tie-orphan 경고로 돌려준다. */
export function normalizeTies(score: Score): InvariantIssue[];
```

- `L` 명령: 현재 음의 `tiedFromPrevious`를 켜고 끕니다. 앞 박에 같은 줄 음이 없으면 바꾸지 않고 "앞에 같은 줄의 음이 없어 붙임줄을 걸 수 없습니다"를 보여 줍니다. 커서가 빈 박에 있으면 앞 박의 그 줄 음을 복사한 뒤 붙임줄을 겁니다. `Shift+L`(박 전체)은 박 안의 모든 음에 같은 규칙을 적용합니다.
- 재생: 펼친 재생 순서(unroll 결과)대로 "트랙·성부·줄별로 아직 울리고 있는 음"을 기억합니다. `tiedFromPrevious`인 음이 오면, 울리고 있는 음과 음높이가 같을 때 그 음의 길이를 늘리고 새 소리를 내지 않습니다. 아니면 보통 음으로 냅니다. 그래서 도돌이표 경계를 넘는 붙임줄도 실제 재생 순서를 따릅니다. 길이는 틱으로 더한 뒤 마지막에 템포 지도로 초를 계산합니다(템포가 바뀌는 구간에서도 정확).
- 그리기: 원래 음에서 이어진 음까지 호를 그립니다. 줄이 바뀌면 앞 줄 끝까지 반쪽 호, 다음 줄 처음에 반쪽 호를 그립니다. 원래 음이 없으면 호를 그리지 않습니다.
- 변환 v2 → v3: `tieOrigin`이 있는 음은 `tiedFromPrevious = true`로 바꾸고 `tieOrigin`·`tieDestination`을 지웁니다. 변환 뒤 `normalizeTies` 결과(원래 음이 없는 붙임줄)를 파일 열기 경고로 보여 줍니다. `NoteRef` 타입은 화면 클릭 위치 정보(`sceneGraph.ts`의 `HitMetadata`)와 클립보드(`ClipboardPayload.source`)에서도 쓰므로 타입은 남기고, 음 데이터에서만 뺍니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R2-a | 커서 정규화를 한 번만, `editWithCursor` 통일, 실행취소 기록에 커서 저장(R2-1) |
| R2-b | 숫자 즉시 입력과 두 자리 합치기(R2-2) |
| R2-c | 키맵 단일화, 명령 ID 타입, 판정 규칙, 충돌 검사, 포커스(R2-3) |
| R2-d | 새 마디 상속, 박자·조 적용 범위, 자동화 지점 이동(R2-4, R2-5) |
| R2-e | 붙임줄 데이터 v3, `ties.ts`, 재생·그리기 연결(R2-6) |

#### 재현 테스트

- `[A1]` 4/4 빈 마디에서 5 → 7 → 8을 입력하면 박 순서대로 5, 7, 8이고 커서는 넷째 박 / 마지막 마디 끝에서 → 하면 새 마디가 생기고 커서가 그 마디에 있음
- `[A2]` 40ms 간격으로 5, →, 7 → 5와 7 / 1, 2를 빠르게 → 12
- `[B12]` `Shift+.` → 점음표 / `Shift+/` → 셋잇단 / `$` → 슬랩 / `|` → free time / 등록되지 않은 단축키 0개(단위) / 키맵 충돌 0개(단위) / `Ctrl+=` → 확대만 되고 음 길이는 그대로 / `key="ㅌ"`, `code="KeyX"` 이벤트로 데드 노트 동작 [흉내] / 앱을 처음 열고 숫자를 누르면 악보에 들어감 / 팔레트 버튼을 누른 뒤 `Ctrl+Z` 동작
- `[B10]` 3/4 곡에 마디를 추가하면 3/4 / 3마디에서 박자를 바꾸면 다음 변경 지점 앞까지 적용
- `[B1]` 붙임줄로 이은 4분음표 두 개 → 재생 이벤트 하나, 길이 960틱 / 마지막 박에서 L → 자기 자신과 이어지지 않음 / 붙임줄 사이에 마디를 넣어도 호가 엉뚱한 음을 가리키지 않음 / 원래 음을 지우면 호가 사라짐
- `[C13]` 2마디 앞에 마디를 넣으면 3마디에 있던 템포 지점이 4마디로 옮겨짐(단위)

#### 완료 기준

- [ ] 위 테스트가 통과한다.
- [ ] 데모곡과 픽스처의 붙임줄이 v3로 변환되어 그대로 보이고 들린다.
- [ ] 키맵의 모든 단축키를 차례로 눌러 보는 e2e 테스트에서 오류가 0건이다.

#### 직접 확인

1. 새 악보에서 5 → 오른쪽 화살표 → 7 → 오른쪽 화살표 → 8을 칩니다. TAB에 5, 7, 8이 차례로 보이는지 봅니다.
2. 같은 입력을 최대한 빨리 칩니다. 57 같은 두 자리 숫자가 생기지 않는지 봅니다.
3. 1과 2를 빠르게 칩니다. 12가 되는지 봅니다.
4. 음을 하나 넣고 한/영 키로 한글 입력 상태로 바꾼 뒤 X를 누릅니다. 그 음이 x(데드 노트)로 바뀌는지 봅니다.
5. 첫 박과 둘째 박에 같은 줄의 음을 넣고 둘째 박에서 L → 재생해서 한 번 길게 울리는지 듣습니다.
6. 박자를 3/4로 바꾼 곡의 마지막 마디 끝에서 → 를 눌러 새 마디가 3/4인지 봅니다.
7. 왼쪽 팔레트의 버튼을 하나 누른 뒤 `Ctrl+Z`를 눌러 실행취소가 되는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| 판정 규칙을 바꿔 기존 단축키가 달라짐 | 키맵 전체를 눌러 보는 e2e 테스트 + 충돌 검사 단위 테스트 |
| 기존 파일의 이상한 붙임줄 데이터 | 변환 경고를 파일 열기 결과로 표시하고 음은 보통 음으로 둠 |
| Mac 단축키 | 이번 점검은 리눅스 크롬만 확인. `detectPlatform` 기준 테스트는 하되 실제 Mac 확인은 Mac이 있을 때 |

#### AI 프롬프트 (R2)

```text
[R2 입력 흐름]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 A1, A2, B1, B10, B12, C13, D6(단축키 정의 통합). 설계서 R2-1 ~ R2-6. PR 5개(R2-a ~ R2-e).
먼저 읽을 것: src/app/controllers/useEditorController.ts, src/app/controllers/useGlobalShortcuts.ts,
  src/commands/{keymap,editorKeymap,registry,shortcuts,editingCommands,paletteCommands}.ts,
  src/engine/editing/{operations,types}.ts, src/store/{documentStore,viewStore}.ts,
  src/engine/audio/compile.ts, src/engine/layout/trackScene.ts(붙임줄 그리기 부분), src/model/types.ts
R2-a: updateCursorSelection의 이중 정규화 제거, 악보를 바꾸는 이동은 editWithCursor로 통일,
      실행취소 기록에 cursorBefore/cursorAfter 저장과 복원.
R2-b: 숫자 즉시 입력 + 0.3초 안 둘째 숫자는 두 자리로 교체(실행취소 한 단계로 합침). 버퍼 방식 제거.
R2-c: KEYMAP_ENTRIES 단일화(Command.shortcut, shortcuts.ts 제거), CommandId 타입, 설계서 표의 판정 규칙,
      물리 키 충돌 검사 테스트, 미등록 단축키 20개 처리표, Ctrl+=/− 수정, 포커스 규칙.
R2-d: 새 마디 상속 규칙, setTimeSignature/setKeySignature(SignatureScope), 자동화 지점 이동.
R2-e: Note.tiedFromPrevious(스키마 v3 + 변환), src/model/ties.ts, normalizeTies를 트랜잭션 파이프라인에 추가,
      compile.ts에서 펼친 순서 기준으로 길이 합치기, trackScene에서 findTieOrigin으로 호 그리기.
금지: 오선보 위치 계산(R4), 재생 순서 계산 unrollScore(R5), 레이아웃 높이 계산(R3) 변경.
```

### R3. 화면 틀(도구줄·악보 글꼴·페이지 배치)

- **목표:** 어떤 데스크톱 화면에서도 모든 기능에 닿을 수 있고, 악보 기호가 보이고, 악보 줄이 서로 겹치지 않게 합니다.
- **끝나면 달라지는 점:**
  - 1024·1280·1440·1920px 화면에서 페이지가 옆으로 밀리지 않고 재생·실행취소 버튼이 항상 보입니다. 자리가 모자라면 덜 쓰는 버튼이 "⋯" 메뉴로 들어갑니다.
  - 쉼표·늘임표·임시표가 보입니다.
  - 악보 줄끼리 겹치지 않고, 줄의 오른쪽 끝이 가지런하며, 짧은 음표가 뭉치지 않습니다. 트랙이 8개여도 모두 보입니다.
- **다루는 항목:** A3, A5, A6
- **크기:** 중간(PR 4개)

#### 설계

**R3-1. 도구줄 (A3)**

리마스터 플레이북 Phase 7의 요구 중 "넘치는 버튼을 메뉴로 옮기기"와 "1024px에서도 핵심 그룹은 항상 보이기"(요구 4·5)만 먼저 가져옵니다. 파일 이름도 플레이북 §4의 이름(`TopToolbar`, `ToolbarOverflowMenu`)을 그대로 써서, 나중에 리마스터가 이 위에 아이콘·LCD 개편을 얹게 합니다.

| 우선순위 | 그룹 | 버튼 |
|---|---|---|
| 0 (항상 보임) | 재생·편집 | 처음·이전·재생/정지·다음·끝, 실행취소·다시실행, LCD, 메트로놈, 구간 반복 |
| 1 | 보기 | 확대·축소, 표시 방식 |
| 2 | 패널 | 패널 보이기·숨기기 |
| 3 (먼저 숨김) | 도구 | +Trk, Tune, Vox, Kit, Cmd, Style, Chord, Scale, Fret, Trans, Check |

- `useToolbarOverflow(containerRef, groups)`: ResizeObserver로 도구줄 폭을 재고, 처음에 잰 그룹별 폭을 기억해 두었다가 우선순위가 낮은 그룹부터 "⋯" 메뉴로 옮깁니다. 메뉴 안의 항목도 같은 명령 ID로 실행하며, CSS로 숨기기만 해서 기능이 사라지는 일은 없게 합니다.
- CSS: `src/ui/styles/reset.css` 7~8행의 `min-width: 1024px; min-height: 768px`와 `shell.css` 7행의 `min-height: 768px`를 지웁니다. 셸 그리드의 가운데 칸은 `minmax(0, 1fr)`로, 넘칠 수 있는 flex 자식에는 `min-width: 0`을 줍니다.
- 1024px 미만: 위쪽에 "편집 기능은 가로 1024px 이상 화면에서 지원합니다" 안내 띠를 보여 주고 좌우 패널을 접습니다. 보기와 재생은 계속 됩니다(결정 2).

**R3-2. 악보 글꼴 (A5)**

- Bravura(SIL Open Font License 1.1)를 앱에 넣습니다. 공식 저장소(github.com/steinbergmedia/bravura)의 배포 파일에서 `Bravura.woff2`, `bravura_metadata.json`, 라이선스 파일을 가져와 글꼴·라이선스는 `public/fonts/bravura/`, 치수 정보는 `src/engine/render/smufl/bravura_metadata.json`에 둡니다. 가져온 릴리스 번호를 README에 적습니다.
- `src/ui/styles/base.css` 1~3행의 `src: local("Bravura")`를 `src: url("/fonts/bravura/Bravura.woff2") format("woff2"); font-display: block;`로 바꿉니다.
- 악보를 처음 그리기 전에 `document.fonts.load("32px Bravura")`를 기다립니다. 3초가 지나도 안 되면 "악보 글꼴을 불러오지 못했습니다" 띠를 띄우고 그대로 그립니다.
- 기호는 SMuFL 글리프 이름으로 참조합니다. `src/engine/render/smufl.ts`를 "이름 → 코드포인트" 표로 넓히고(SMuFL의 `glyphnames.json`에서 필요한 것만), 지금 유니코드 음악 기호(U+1D11E 등)와 대체 글꼴에 기대는 음자리표도 SMuFL 글리프(`gClef`, `gClef8vb`, `fClef`, `fClef8vb`, `unpitchedPercussionClef1`)로 바꿉니다.
- 기호 크기와 위치는 화면에서 글꼴을 재지 않고 `bravura_metadata.json`의 `glyphBBoxes`·`glyphAdvanceWidths`·`engravingDefaults`(단위: 오선 간격)로 계산합니다. 그래야 브라우저와 Node 테스트의 결과가 같습니다. SMuFL 규칙상 글꼴 크기는 오선 간격의 4배입니다(오선 간격 8px → 32px).

**R3-3. 페이지 배치 (A6)**

1. **높이 계산을 하나로.** `src/engine/layout/staffMetrics.ts`(신규)의 `trackStack(track, style)`이 트랙 하나의 보표 띠 목록과 높이를 돌려줍니다. `trackScene.ts`의 `trackHeight`(1781행)와 `pageLayout.ts`의 `calculateSystemHeight`(71행)를 모두 이것으로 바꿉니다. 지금은 앞의 것이 6현 트랙을 156px로, 뒤의 것이 116px로 계산해 줄이 겹칩니다.

```ts
export interface StaffBand {
  kind: "standard" | "tab" | "slash" | "percussion";
  top: number;          // 트랙 시작점 기준
  height: number;
  marginAbove: number;  // 위쪽 표시(효과 글자 등)를 위한 여유
  marginBelow: number;  // 아래쪽 표시(TAB 리듬 꼬리 등)를 위한 여유
}
export function trackStack(track: Track, style: Stylesheet): { bands: StaffBand[]; height: number };
```

2. **잰 다음 쌓기.** 시스템(악보 한 줄)을 먼저 그려서, 구간 표시·효과 글자·리듬 꼬리처럼 위아래로 튀어나온 것까지 포함한 실제 영역(bounding box)을 구합니다. 글자는 글꼴 크기로 어림한 폭을 씁니다. `src/engine/layout/pageStacker.ts`(신규)가 그 높이로 페이지에 쌓고, 다음 줄이 아래 여백을 넘으면 새 페이지를 시작합니다. 줄 사이 간격은 스타일시트의 `systems.systemGap`·`systems.trackGap`을 씁니다.
   - 시스템 하나가 페이지보다 높으면(트랙이 많을 때) 그 시스템만 줄여서(최소 0.6배) 한 페이지에 넣습니다. 0.6배로도 안 들어가면 경고를 띄우고 넘치게 둡니다. 세로 스크롤 화면 모드에서는 줄이지 않습니다.
3. **가로 간격.** 지금은 음 길이에 정비례해서 배치하므로(`measureContents.ts`의 `tickToMeasureX`, 36행) 64분음표 머리가 4.2px 간격으로 겹칩니다. `src/engine/layout/spacing.ts`(신규)는 악보 조판에서 흔히 쓰는 로그 간격을 씁니다.

```text
간격(d) = s0 × (1 + k × log2(d / d_min))
  d      = 그 박의 길이(틱), d_min = 그 줄에서 가장 짧은 박
  k      = 스타일시트 page.rhythmProportion 에서 계산(지금은 쓰이지 않는 값)
  최소값 = 음표 머리 폭 × 1.6 + (임시표·점·꼬리가 있으면 그 폭)
마디의 이상 폭 = 머리말(음자리표·조표·박자표: 줄 첫 마디와 변경 마디만) + Σ 간격 + 좌우 여백
```

4. **줄 나누기와 양끝 맞춤.** `systemBreaker.ts`의 `breakSystems`는 이상 폭의 합으로 줄을 나눕니다. `justifyMeasures`(64행)는 지금 위치만 정하고 폭을 늘리지 않으므로, 남는 폭을 각 마디의 늘어날 수 있는 부분(간격)에 비례해 나눠 줍니다: `배율 = (콘텐츠 폭 − 고정 폭 합) / 간격 합`. 마지막 줄은 채움 비율이 0.75 미만이면 늘리지 않습니다(스타일시트 `page.justifyLastSystem`이 켜져 있으면 늘림). 첫 줄 들여쓰기 `page.firstSystemIndent`와 최소 마디 폭 `page.minMeasureWidth`도 여기서 씁니다.
5. **머리말 자리.** R4에서 그릴 음자리표·조표·박자표의 폭을 R3에서 미리 확보합니다. 줄 중간에서 박자나 조가 바뀌면 그 마디 앞에 폭을 더합니다. 그러면 "4/4 C" 글자가 첫 박과 겹치는 문제도 함께 사라집니다.

레이아웃 검사 테스트 `src/engine/layout/layout.invariants.test.ts`(신규)를 둡니다. 픽스처마다 다음을 확인합니다.

- 같은 페이지의 시스템 영역이 서로 겹치지 않는다.
- 마지막 줄을 뺀 모든 줄의 오른쪽 끝이 콘텐츠 오른쪽 끝과 0.5px 안으로 같다.
- 모든 요소가 페이지 안에 있다.
- 한 성부 안에서 이웃한 음표 머리 사이 거리가 머리 폭 이상이다.
- 8트랙 픽스처의 모든 트랙이 페이지 안에 있다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R3-a | `TopToolbar`·`ToolbarOverflowMenu`·넘침 처리, CSS 최소 크기 삭제, 1024px 미만 안내 띠(R3-1) |
| R3-b | Bravura 포함, 글꼴 로딩 대기, SMuFL 이름 표, 메타데이터 치수(R3-2) |
| R3-c | `staffMetrics`·`pageStacker`(줄 겹침·페이지 넘침)(R3-3의 1·2) |
| R3-d | `spacing`, 줄 나누기·양끝 맞춤, 머리말 자리(R3-3의 3~5) |

#### 재현 테스트

- `[A3]` 1024×768, 1280×768, 1440×900, 1920×1080에서 `document.documentElement.scrollWidth ≤ innerWidth` / 재생·실행취소 버튼이 화면 안에 있음 / "⋯" 메뉴 안의 명령도 실행됨
- `[A5]` `document.fonts.check("32px Bravura")`가 참 / 쉼표·늘임표 요소의 크기가 0이 아님
- `[A6]` 위 레이아웃 검사 다섯 가지

#### 완료 기준

- [ ] 위 테스트가 통과한다.
- [ ] 화면 비교 기준 이미지를 이 단계에서 한 번 갱신했고, 성태 님이 차이 이미지를 보고 승인했다(이 단계 말고는 기준 갱신 금지).

#### 직접 확인

1. 브라우저 창을 좁혔다 넓혔다 해 봅니다. 페이지가 옆으로 밀리지 않고 재생 버튼이 계속 보이는지, 자리가 모자라면 "⋯"가 생기고 그 안에 버튼이 있는지 봅니다.
2. 데모곡에서 쉼표와 늘임표가 보이는지 봅니다.
3. 데모곡 첫 페이지에서 둘째 줄의 기타 오선이 첫 줄의 베이스 TAB을 덮지 않는지, 줄의 오른쪽 끝이 가지런한지 봅니다.
4. `+ Track`으로 트랙을 8개까지 늘려 모든 트랙이 보이는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| 레이아웃이 바뀌어 화면 비교 기준 이미지가 모두 달라짐 | 이 단계에서 한 번만 갱신하고, 차이 이미지를 성태 님이 확인 |
| 줄이기(0.6배)로 글자가 너무 작아짐 | 줄인 페이지에 표시를 남기고, 트랙 수가 많으면 "트랙별 보기"를 권하는 안내 |
| 도구줄 작업이 리마스터 Phase 7과 겹침 | 파일 이름과 구조를 플레이북 §4에 맞춰, Phase 7은 이 위에 모양만 바꾸게 함 |

#### AI 프롬프트 (R3)

```text
[R3 화면 틀]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 A3, A5, A6. 설계서 R3-1 ~ R3-3. PR 4개(R3-a ~ R3-d).
먼저 읽을 것: src/ui/shell/EditorShell.tsx(도구줄 부분), src/ui/styles/{reset,shell,base,toolbar,tokens}.css,
  리마스터 플레이북 Phase 7의 요구 4·5와 §4 목표 구조, src/engine/render/{smufl.ts,SvgRenderer.tsx},
  src/engine/layout/{layoutScore,pageLayout,systemBreaker,measureContents,metrics,trackScene,sceneGraph}.ts
R3-a: TopToolbar + ToolbarOverflowMenu + useToolbarOverflow(ResizeObserver, 설계서의 우선순위 표).
      reset.css·shell.css의 최소 크기 삭제, 1024px 미만 안내 띠. 네 화면 크기 e2e.
R3-b: Bravura.woff2·bravura_metadata.json·라이선스 추가, base.css @font-face 교체, document.fonts.load 대기,
      smufl.ts를 SMuFL 이름 표로, 음자리표를 SMuFL 글리프로, 치수는 메타데이터로 계산.
R3-c: staffMetrics.trackStack 단일 높이, pageStacker(잰 뒤 쌓기, 넘치면 줄이기 최소 0.6), 레이아웃 검사 테스트.
R3-d: spacing.ts(로그 간격, rhythmProportion 연결), breakSystems·justifyMeasures 양끝 맞춤,
      firstSystemIndent·minMeasureWidth·justifyLastSystem 연결, 머리말 폭 확보.
금지: 음 높이 위치 계산(pitchToStaffY) 변경(R4에서 한다), 화면 비교 기준 이미지를 기계적으로 갱신.
```

### R4. 오선보 다시 만들기

- **목표:** 오선보를 표준 기보법대로 그려 악보로 읽을 수 있게 하고, 오선에서 음을 넣을 수 있게 합니다.
- **끝나면 달라지는 점:**
  - 음표가 제 높이에 그려지고, 오선 밖의 음에는 덧줄이 붙습니다. 기타는 "높은음자리표 아래 8", 베이스는 낮은음자리표로 그립니다.
  - 조표·박자표가 기호로 그려지고 줄 중간의 변경도 보입니다.
  - 임시표(♯, ♭, ♮)가 규칙대로 자동으로 붙습니다.
  - 오선에서 높이를 골라 음을 넣으면 알맞은 줄과 프렛이 정해집니다.
  - 트랙마다 "오선만 / TAB만 / 둘 다"를 고를 수 있고, 피아노는 두 단 보표, 드럼은 타악기 보표로 그립니다.
  - 해머링·슬라이드·벤딩 같은 효과가 글자 대신 기호로 그려지고, 벤딩 값(1/2, full 등)이 맞게 표시됩니다.
- **다루는 항목:** A4, B11, C6, C7, B4(표기)
- **크기:** 큼(PR 7개). 새 오선 엔진을 기존 코드 옆에 만들고 설정으로 전환하다가, 끝나면 옛 코드를 지웁니다.

#### 설계

**R4-0. 데이터 형식 v4: 트랙 종류, 음자리표, 음높이 규칙**

- `Track.kind: "stringed" | "pitched" | "percussion"`을 추가합니다. 변환 규칙: 드럼·타악기 아이콘이면 `percussion`, `interpretation.stringed`가 false이거나 피아노·관현악·MIDI 계열이면 `pitched`, 나머지는 `stringed`. 판단이 애매하면 `stringed`로 두고 변환 경고를 남깁니다.
- `Track.clef: "treble" | "treble8vb" | "bass" | "bass8vb" | "percussion" | "grand"`을 추가합니다. 기타류는 `treble8vb`, 베이스 기타는 `bass8vb`, 그 밖에는 악기 정의(`instruments.ts`)의 `clef` 값을 씁니다.
- 음높이 규칙을 `src/model/trackKind.ts`(신규)로 정하고 `derive.ts`의 `noteMidiPitch`를 이것으로 바꿉니다.

| 트랙 종류 | 음높이의 출처 | 저장하지 않는 것 |
|---|---|---|
| stringed(기타·베이스 등) | 튜닝[줄] + 카포 + 프렛 | `midiPitch`(저장 금지. 변환 때 삭제) |
| pitched(피아노 등) | `note.midiPitch` | 줄·프렛(쓰지 않음) |
| percussion(드럼) | `note.midiNumber`(GM 타악기 번호) + `articulation` | 줄·프렛(쓰지 않음) |

- 이 규칙으로 두 가지 결함의 근본 원인이 함께 사라집니다. 가져온 음의 프렛을 고쳐도 음높이가 그대로이던 문제(B14의 일부, 지금은 `noteMidiPitch`가 캐시된 `midiPitch`를 먼저 씀)와, 피아노를 가짜 "줄"로 다뤄 C3 아래를 넣을 수 없던 문제(C7)입니다.
- 불변식 추가(fatal): percussion 음에는 `midiNumber`, pitched 음에는 0~127의 `midiPitch`가 있어야 합니다.

**R4-1. 음 이름 정하기 — `src/engine/notation/pitchSpelling.ts`(신규)**

```ts
export interface SpelledPitch { step: "C" | "D" | "E" | "F" | "G" | "A" | "B"; alter: -2 | -1 | 0 | 1 | 2; octave: number }
export function keyFifths(key: KeySignature): number;   // src/model/keys.ts. musicXml.ts에 있는 keyFifths 표를 여기로 옮겨 하나로
export function spellPitch(midi: number, fifths: number, prefer?: "sharp" | "flat"): SpelledPitch;
```

1. 조의 글자별 변화를 만듭니다. fifths > 0이면 F C G D A E B 순서로 앞에서 fifths개에 +1, fifths < 0이면 B E A D G C F 순서로 앞에서 |fifths|개에 −1.
2. pc = midi mod 12. 일곱 글자 중 (글자의 자연음 pc + 조의 변화) mod 12 = pc인 글자가 있으면 그 글자를 씁니다(조 안의 음).
3. 없으면(조 밖의 음) 방향을 정합니다. 우선순위는 음 단위 설정(`note.accidental`) → 트랙 설정(`tuning.accidentalPreference`) → 조의 방향(fifths ≥ 0이면 올림). 올림이면 한 글자 아래 음에 +1, 내림이면 한 글자 위 음에 −1을 붙입니다. 겹올림·겹내림이 필요한 철자는 피합니다.
4. 옥타브 = floor((midi − alter) ÷ 12) − 1.

| 검산 예 | 결과 |
|---|---|
| C장조(0), midi 61 | C♯4 |
| F장조(−1), midi 70 | B♭4(조 안의 음) |
| F장조(−1), midi 66 | G♭4(조 방향이 내림) |
| E장조(+4), midi 63 | D♯4(조 안의 음) |
| G♭장조(−6), midi 71 | C♭5(소리는 B4, 옥타브 = floor(72 ÷ 12) − 1 = 5) |

**R4-2. 오선 위치와 덧줄 — `src/engine/notation/staffPosition.ts`(신규)**

```ts
export type Clef = "treble" | "treble8vb" | "bass" | "bass8vb" | "percussion";
export function diatonicIndex(p: SpelledPitch): number;   // octave × 7 + "CDEFGAB".indexOf(step)
export function clefBottomLine(clef: Clef): number;       // treble·treble8vb: E4 → 30 / bass·bass8vb: G2 → 18
export function clefDisplayOffset(clef: Clef): number;    // treble8vb·bass8vb: +12 (소리보다 한 옥타브 높게 적음)
export function staffPosition(written: SpelledPitch, clef: Clef): number; // 0 = 맨 아랫줄, 8 = 맨 윗줄, 홀수 = 칸
export function ledgerLines(position: number): number[];  // 아래: −2, −4, … / 위: 10, 12, …
export function positionToY(position: number, staffTop: number, space: number): number; // staffTop + (8 − position) × space / 2
```

- 적는 음높이 = 소리 음높이 + `clefDisplayOffset(clef)` + (concertTone이 꺼져 있으면) 이조 악기 차이 + 옥타브 기호(8va 등). 지금의 `writtenPitch`(derive.ts 51행)에 음자리표 차이만 더하면 됩니다.
- 검산: 기타 6번 줄 개방현(E2, midi 40) → `treble8vb`에서 적는 음 E3 → diatonic 23 → 위치 −7 → 덧줄 −2·−4·−6(세 개), 음표는 셋째 덧줄 아래에 매달립니다. 기타 1번 줄 개방현(E4) → 적는 음 E5 → 위치 7(맨 윗칸).
- 지금의 `pitchToStaffY`(trackScene.ts 1767행, 반음마다 같은 간격 + 옥타브 접기)는 지웁니다.

**R4-3. 임시표 — `src/engine/notation/accidentals.ts`(신규)**

- 마디마다, 오선마다 "글자+옥타브 → 지금 적용 중인 변화" 표를 조표 값으로 시작합니다. 박 순서대로(같은 박의 화음은 낮은 음부터) 음마다 필요한 변화를 표와 비교해, 다르면 임시표를 붙이고 표를 갱신합니다. 자연음으로 돌아가면 ♮를 붙입니다.
- 붙임줄로 이어진 음은 임시표를 다시 붙이지 않습니다(마디를 넘는 경우 포함). `note.forceAccidental`이면 같아도 붙입니다.
- 화음의 임시표 열: 높은 음부터 오른쪽 열에 놓고, 위아래 위치 차이가 6 미만으로 겹치면 한 열 왼쪽으로 옮깁니다.

**R4-4. 기둥·머리·쉼표 — `src/engine/notation/stems.ts`(신규)**

- 기둥 방향: 박의 `stemDirection`이 auto가 아니면 그 값. 성부가 여럿이면 성부 1·3은 위, 2·4는 아래(스타일시트 `notation.stemDirectionVoice1/2`가 우선). 성부가 하나면 가운데 줄(위치 4)에서 가장 먼 음을 기준으로, 그 음이 가운데 줄 이상이면 아래.
- 기둥 길이는 3.5칸이고, 덧줄 바깥 음은 가운데 줄까지 늘립니다. 2도 화음은 기둥 반대편으로 머리를 옮깁니다.
- 쉼표는 성부가 하나면 기본 위치, 여럿이면 성부 1은 위·2는 아래(스타일시트 `notation.restPositionVoice1/2`).

**R4-5. 음자리표·조표·박자표 — `src/engine/notation/signatureLayout.ts`(신규)**

- 높은음자리표의 올림표 위치(오선 위치 번호): F 8, C 5, G 9, D 6, A 3, E 7, B 4. 내림표: B 4, E 7, A 3, D 6, G 2, C 5, F 1. 낮은음자리표는 각각 2를 뺍니다.
- 박자표는 SMuFL 숫자 글리프(`timeSig0`~`timeSig9`)를 위아래로 놓습니다. 스타일시트의 `notation.replaceCommonTime`·`replaceCutTime`이 켜져 있으면 4/4·2/2를 C 기호로 바꿉니다.
- 줄 첫머리에는 음자리표 + 조표(+ 곡 첫 줄이나 바뀌는 곳에서 박자표). 줄 중간에서 바뀌면 그 마디 앞에 새 조표(이전 조표를 지우는 제자리표 포함)와 박자표를 그립니다.

**R4-6. 보표 구성 (C7, B4 표기)**

- 트랙의 `notationTypes`(standard / tab / slash)에 따라 R3의 `trackStack`이 보표 띠를 만듭니다. 스타일시트 `systems.hideTabForStandardOnly` 같은 설정도 여기서 반영합니다.
- `staffConfig: "grand"`(피아노)는 두 단으로 그립니다. 처음 규칙은 midi 60 이상은 위 단(높은음자리표), 미만은 아래 단(낮은음자리표)입니다. 음마다 위·아래 단을 직접 정하는 기능은 나중 과제입니다.
- 타악기 트랙은 타악기 음자리표와 5줄 보표로 그립니다. 음의 높이는 `instruments.ts`의 `DRUM_MAPPINGS`(82~94행)에 있는 `staffLine`, 머리 모양은 악기별(심벌류는 × 머리). TAB 띠를 만들지 않으므로 지금 1번 줄에 "0"이 겹쳐 보이던 문제가 사라집니다.

**R4-7. 오선에서 입력 (B11)**

- 클릭: 클릭 위치 정보에서 오선 위치를 얻고 → 조표를 반영해 적는 음을 정하고 → 음자리표·이조 차이를 빼서 소리 음높이를 구합니다. 그다음은 트랙 종류에 따라 다릅니다.
  - stringed: 커서가 있는 줄에서 칠 수 있으면(0 ≤ 프렛 ≤ 최대) 그 줄. 아니면 같은 박에서 비어 있는 줄 중 앞 음의 손 위치에 가장 가까운 줄. 어디서도 칠 수 없으면 "이 음은 지금 튜닝으로 칠 수 없습니다".
  - pitched: 그 음높이를 `midiPitch`로 저장.
  - percussion: 위치에 가장 가까운 `DRUM_MAPPINGS` 악기.
- 키보드: 오선 모드에서 ↑/↓는 커서의 오선 위치(`CursorPosition.staffLine`)를 조 안의 다음 음으로 옮기고, `Alt+↑/↓`는 반음씩 옮깁니다. 숫자 키는 지금처럼 "줄 번호"이지만, 넣는 프렛은 커서 위치의 음높이로 계산합니다(`inputStandardString`이 지금은 항상 개방현을 넣음). `Enter`는 줄을 자동으로 골라 넣습니다.

**R4-8. 효과 기호 (C6)**

- 지금 글자로 나오는 효과를 표준 기호로 바꿉니다. 자주 쓰는 순서대로 해머링·풀오프(호 + H/P), 슬라이드(사선), 벤딩(곡선 화살표 + 값), 비브라토(물결), 팜뮤트(P.M. 점선), 렛링, 하모닉스(◇ 머리), 데드 노트(× 머리), 고스트 노트(괄호), 악센트·스타카토, 트레몰로 피킹(빗금), 트릴(tr)입니다.
- 벤딩 값은 지금 항상 "full"로 나옵니다. `BendCurve.points`의 최댓값(반음 단위)으로 1/4, 1/2, full, 1½, 2 등을 표시합니다.
- 빔은 박 단위로 묶고 기울기를 한 칸 이내로 제한합니다. 이번 단계에서 못 한 효과는 PR 설명의 "남은 기호" 목록에 적고 R9로 넘깁니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R4-a | 데이터 v4(트랙 종류·음자리표·음높이 규칙), 변환, 불변식(R4-0) |
| R4-b | `pitchSpelling`·`staffPosition`·덧줄 + 표 기반 단위 테스트(R4-1, R4-2) |
| R4-c | 새 오선 그리기(`standardStaffScene.ts`): 음자리표·위치·덧줄·기둥·쉼표. 설정으로 옛/새 엔진 전환(R4-4) |
| R4-d | 임시표, 조표·박자표 기호, 줄 중간 변경(R4-3, R4-5) |
| R4-e | 보표 구성: 표기 설정, 두 단 보표, 타악기 보표(R4-6) |
| R4-f | 오선 입력(R4-7) |
| R4-g | 효과 기호·벤딩 값·빔 다듬기, 옛 오선 코드 삭제(R4-8) |

#### 재현 테스트

- `[A4]` 기타 E2 → 위치 −7, 덧줄 3개(단위 + 화면 요소 검사) / G장조 조표 = F 자리(위치 8)에 ♯ 하나 / 3마디에서 박자가 바뀌면 3마디 앞에 박자표 기호 / 베이스 트랙은 낮은음자리표
- `[B11]` 기타에서 커서가 3번 줄일 때 A3 위치에 입력 → 3번 줄 2프렛 / 칠 수 없는 음 → 안내 문구, 악보 그대로
- `[C7]` 피아노 트랙에 C2(midi 36) 입력 가능 / TAB만 고른 트랙은 오선이 없음
- `[B4]`(표기) 드럼 트랙에 TAB 띠가 없고, 킥이 `DRUM_MAPPINGS`의 위치에 그려짐
- `[C6]` 반음 벤딩은 "1/2"로 표시

픽스처 8개의 첫 페이지를 화면 비교 기준 이미지로 만듭니다. 기준 이미지는 성태 님이 아래 "직접 확인"의 기준으로 눈으로 본 뒤 승인합니다.

#### 완료 기준

- [ ] 위 테스트가 통과한다.
- [ ] 옛 오선 코드(`pitchToStaffY` 등)를 지웠고 전환 설정도 없앴다.
- [ ] 데모곡의 오선보를 성태 님이 확인했다.

#### 직접 확인

1. 기타 6번 줄 개방현(0)을 넣으면 음표가 오선 아래 덧줄 세 개 밑에 매달리는지 봅니다.
2. 기타 1번 줄 개방현(0)은 오선 맨 위 칸에 있는지 봅니다.
3. 곡의 조를 G장조로 바꾸면 맨 윗줄에 ♯ 하나가 생기는지, 1번 줄 1프렛(F)을 넣으면 그 음에 ♮가 붙는지 봅니다.
4. 베이스 트랙이 낮은음자리표인지 봅니다.
5. 3마디에서 박자를 3/4로 바꾸면 3마디 앞에 3/4 기호가 보이는지 봅니다.
6. 오선을 클릭해 오선 모드로 바꾼 뒤 위아래 화살표로 높이를 옮기고 3을 누르면, TAB의 3번 줄에 알맞은 프렛이 들어가는지 봅니다.
7. 드럼 트랙에서 TAB의 "0"이 사라지고 드럼 보표로 보이는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| `trackScene.ts`(1,789줄)를 크게 바꾸다 다른 표기가 깨짐 | 새 오선 그리기를 별도 파일로 만들고 설정으로 전환. 완료 전까지 옛 엔진 유지 |
| 기보 규칙의 세부 차이(예외가 많음) | 이번 범위는 위 R4-1~R4-8로 고정. 나머지는 "남은 기호" 목록으로 |
| 변환(v4) 중 트랙 종류를 잘못 추정 | 변환 경고 표시 + 트랙 설정에서 종류를 바꿀 수 있게 함 |

#### AI 프롬프트 (R4)

```text
[R4 오선보 다시 만들기]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 A4, B11, C6, C7, B4(표기). 설계서 R4-0 ~ R4-8. PR 7개(R4-a ~ R4-g).
먼저 읽을 것: src/model/{types,derive,instruments,factory}.ts, src/io/musicXml.ts(keyFifths 표),
  src/engine/layout/{trackScene,staffMetrics,spacing,primitiveFactory,sceneGraph}.ts,
  src/engine/render/smufl.ts, src/engine/editing/operations.ts(inputFret, inputStandardString),
  specs/03-기보법-심볼과-이펙트.md
원칙: src/engine/notation/ 의 함수는 모두 순수 함수이고, 설계서의 검산 표를 단위 테스트로 먼저 만든다.
R4-a: Track.kind·Track.clef(스키마 v4 + 변환 + 경고), src/model/trackKind.ts, noteMidiPitch 교체,
      stringed의 midiPitch 저장 금지, 불변식 추가.
R4-b: pitchSpelling.ts, staffPosition.ts, src/model/keys.ts로 keyFifths 단일화.
R4-c: standardStaffScene.ts(새 오선 그리기). preferences의 임시 설정으로 옛/새 엔진 전환.
R4-d: accidentals.ts, signatureLayout.ts, 줄 중간 변경.
R4-e: trackStack에 notationTypes·staffConfig·타악기 반영.
R4-f: 클릭·화살표·숫자·Enter 오선 입력(설계서 R4-7).
R4-g: 효과 기호, 벤딩 값, 빔 다듬기, 옛 pitchToStaffY와 전환 설정 삭제.
금지: TAB 그리기 규칙 변경(붙임줄·드럼 띠 제외), 재생 코드 변경.
```

### R5. 재생

- **목표:** 소리가 깨지지 않고, 악보에 적힌 순서와 표현대로, 화면 상태와 맞게 재생되게 합니다.
- **끝나면 달라지는 점:**
  - 데모곡이 찌그러지지 않습니다.
  - 재생 중 마디를 옮겨도 화면 표시와 소리가 맞고, Space로 언제나 멈출 수 있습니다.
  - D.S. al Coda와 두 마디짜리 1번 괄호가 맞는 순서로 재생되고, 늘임표와 셋잇단 느낌(스윙)이 들립니다.
  - 템포가 서서히 바뀌는 구간에서도 재생 위치 표시가 맞습니다.
  - 재생 중 음소거·볼륨을 바꾸면 바로 들리고, 믹서 설정이 파일에 저장됩니다.
  - 드럼이 드럼 소리로 납니다.
  - 구간 반복이 구간 끝에서 처음으로 돌아가고, 화면이 재생 위치를 따라갑니다.
  - LCD에 실제 템포가 나오고 숫자로 바꿀 수 있습니다.
- **다루는 항목:** A7, A8, B2, B3, B4(소리), B5, C4
- **크기:** 큼(PR 6개). 사운드폰트(R5-B)는 선택 작업으로 PR 3~4개가 더해집니다.

#### 설계

**R5-1. 재생 상태 기계 (A7)**

- 원인: `scheduler.ts`의 `seek()`(94~101행)는 `play()`를 다시 부르고, `play()`(31~32행)는 먼저 `stop("manual")`로 이전 재생의 `onStop`을 호출합니다. 그 신호가 화면 상태를 "정지"로 바꾸는데 소리는 새로 시작되므로 둘이 어긋납니다.
- `src/engine/audio/transport.ts`(신규): 상태는 `stopped → starting → playing ⇄ paused → stopped`이고, 상태를 바꾸는 함수는 `play(fromTick)`, `pause()`, `stop()`, `seek(tick)` 네 개뿐입니다.
- 재생 세션 번호: 재생을 시작할 때마다 `sessionId`가 1씩 늘고, 스케줄러가 보내는 모든 신호(`onPosition`, `onEnded`)에 이 번호가 붙습니다. 지금 세션이 아닌 신호는 무시합니다.
- `seek(tick)`: 재생 중이면 지금 세션에서 예약된 소리를 10ms 안에 줄여 끄고 새 위치부터 다시 예약합니다. 상태는 `playing` 그대로이고 정지 신호를 보내지 않습니다.
- Space는 스토어의 현재 상태(`usePlaybackStore.getState().status`)를 읽어 재생과 정지를 전환합니다. `usePlaybackController.ts`의 `onStop` 처리(97~110행)는 세션 번호를 확인한 뒤에만 실행합니다.

**R5-2. 소리 구조와 음량 (A8)**

- 지금: 음 하나마다 오실레이터 → 필터 → 게인 → EQ → 효과 사슬(오버드라이브, 리버브용 ConvolverNode 등) → 패너를 새로 만들어(`sampler.ts` 31~66행) 마스터(게인 0.2 → 컴프레서)로 보냅니다. 베이스를 뺀 모든 트랙의 기본값이 오버드라이브 0.24 + 리버브 0.18 + bright EQ입니다(`mixer.ts` 62~80행). 효과가 음마다 따로 걸려 소리가 겹겹이 쌓이고, 처리량도 많습니다.
- 새 구조 `src/engine/audio/audioGraph.ts`(신규):

```text
음(voice): 오실레이터 또는 샘플 → 엔벨로프 게인 ──┐
                                                ▼
트랙 버스(트랙마다 1개, 재생하는 동안 유지):
  입력 → EQ → 효과 사슬(트랙당 1벌) → 볼륨 게인 → 좌우 패너 → 음소거·솔로 게인 ──┐
                                                                              ▼
마스터 버스: 마스터 볼륨(여유 −6dB) → 안전 리미터(DynamicsCompressor: threshold −3dB,
             ratio 20, attack 3ms, release 250ms) → 출력
```

- 기본값은 효과 없음(EQ flat, 효과 사슬 비어 있음)입니다. 효과는 사용자가 켤 때만 씁니다.
- 음 하나의 크기: 다이내믹(ppp~fff) → 벨로시티 → 게인. 처음 범위는 0.05~0.25로 두고, 아래 측정 테스트를 통과하도록 조정합니다.
- 측정 목표: 데모곡 최대 −1 dBFS 이하, 한계치 이상 구간 0초, 평균 크기(RMS) −20~−14 dBFS.
- 볼륨 단위 통일: 모델의 볼륨과 볼륨 자동화 값은 0~1(페이더 위치)입니다. 페이더 → 게인 변환은 한 함수(`faderToGain(v) = v²`)에서만 합니다. 지금 `normalizeVolume`(mixer.ts 221행)은 1보다 큰 값을 퍼센트로 보는데 편집 화면은 1.2까지 입력을 받아, 데모 3마디에서 0.7357이 0.0001로 떨어집니다. v5 변환에서 기존 값이 1.2보다 크면 100으로 나누고, 나머지는 1을 넘지 않게 자릅니다. 편집 화면 입력도 0~1(0~100%로 표시)로 바꿉니다.

**R5-3. 믹서를 악보 데이터로 (B5) — 데이터 형식 v5**

- 지금 믹서 상태(`MixerState`)는 `playbackStore`에만 있어서 파일에 저장되지 않습니다.
- v5에서 `Track.mix = { volume, pan, mute, solo, eq, effects }`와 `Score.masterMix = { volume, focusPercent }`를 추가합니다. "V"(보이기)는 화면 설정이므로 믹서에서 빼서 화면 상태로 옮기고, 소리에는 영향을 주지 않게 합니다(지금은 V를 끄면 소리도 꺼짐).
- 믹서 변경도 실행취소할 수 있게 하되, 슬라이더를 끄는 동안이 아니라 손을 뗄 때 한 단계로 기록합니다.
- 재생 중 변경은 트랙 버스의 값을 `setTargetAtTime(값, 지금, 0.01)`로 바로 바꿉니다. 음 이벤트에는 믹서 값을 굽지 않고 `trackId`만 담습니다(`mixer.ts`의 `buildNoteMix` 제거).
- 볼륨·좌우 자동화는 재생을 준비할 때 트랙 버스 값의 예약(`linearRampToValueAtTime`)으로 바꿉니다.

**R5-4. 재생 순서 (B2) — `unrollScore` 다시 작성**

명세 spec 03의 규칙을 그대로 구현합니다.

1. 도돌이: 여는 도돌이표 위치를 기억하고, 닫는 도돌이표(`repeatClose` = 총 연주 횟수 n)에서 n−1번 되돌아갑니다. 여는 표가 없으면 곡 처음으로 돌아갑니다.
2. 다른 괄호(alternate endings): 표시가 없는 마디도 앞 마디의 괄호를 이어받습니다(명세의 "암묵 연장" 규칙). 닫는 도돌이표가 있는 마디까지 이어지고, 다른 괄호 표시나 여는 도돌이표가 나오면 끝납니다. k번째 반복에서 유효 괄호에 k가 없는 마디는 건너뜁니다.

```text
유효괄호[i] = 괄호표시[i] ≠ 0 ? 괄호표시[i]
            : (유효괄호[i−1] ≠ 0 그리고 마디 i−1이 도돌이를 닫지 않음 그리고 마디 i가 여는 도돌이가 아님) ? 유효괄호[i−1]
            : 0
```

3. 점프: D.C.(처음으로), D.S.(세뇨로), D.S.S.(세뇨세뇨로). "al Fine"이면 그 뒤 Fine에서 끝내고, "al Coda"·"al Double Coda"이면 그 뒤 "To Coda"(`DaCoda`)에서 코다로 갑니다. **To Coda는 al Coda 점프를 한 뒤에만 동작합니다**(명세 규칙). 지금 코드는 처음 만나는 순간 바로 점프합니다.
4. 점프한 뒤의 도돌이표는 다시 반복하지 않습니다(일반 관례). 곡마다 바꾸는 설정은 나중 과제입니다.
5. 무한 반복 방지: 펼친 마디 수가 (전체 마디 × 최대 반복 횟수 × 4)를 넘으면 경고와 함께 멈춥니다.

```text
pc = 0;  passes = {};  jumped = false;  codaArmed = false;  fineArmed = false
while pc < 마디 수:
  if 유효괄호[pc] ≠ 0 이고 현재반복번호 ∉ 유효괄호[pc]:  pc = 괄호 묶음 다음 마디;  continue
  내보내기(pc)
  if fineArmed 이고 pc에 Fine:  끝
  if codaArmed 이고 pc에 To Coda:  pc = 코다 위치;  codaArmed = false;  continue
  if pc가 도돌이를 닫음 이고 not jumped 이고 passes[시작] < n − 1:  passes[시작]++;  pc = 시작;  continue
  if pc에 점프 이고 아직 안 씀:  사용 표시;  fineArmed/codaArmed 설정;  jumped = true;  pc = 대상;  continue
  pc = pc + 1
```

| 픽스처 | 기대 순서(마디 번호) |
|---|---|
| 단순 도돌이(1~2 반복, 3) | 1 2 1 2 3 |
| 1·2번 괄호(마디 2 = 1번, 마디 3 = 2번) | 1 2 1 3 4 |
| 두 마디짜리 1번 괄호(마디 2만 표시, 마디 3에 닫는 도돌이) | 1 2 3 1 4 5 |
| D.S. al Coda(세뇨 2, To Coda 4, D.S. al Coda 6, 코다 7) | 1 2 3 4 5 6 2 3 4 7 8 |
| D.C. al Fine(Fine 2, D.C. al Fine 4) | 1 2 3 4 1 2 |
| 3회 반복(`repeatClose` = 3) | 1 2 1 2 1 2 3 |

**R5-5. 템포 지도와 표현 (B3, B2 나머지)**

- 템포 램프 구간의 역변환(`tempoMap.ts`의 `secondsToTicks`, 140~162행)을 정방향 식(`secondsForTickRange`)과 정확히 맞는 식으로 바꿉니다.

```text
t = t0 + (T × b0 / Δ) × (exp(s × Δ / (60 × Q)) − 1)
  b0 = 구간 시작 BPM,  Δ = 끝 BPM − 시작 BPM,  T = 구간 길이(틱),  Q = T ÷ 480(4분음표 개수),
  s  = 구간 시작부터 지난 초,  t0 = 구간 시작 틱
```

  지금 코드는 지수 안에 Δ 대신 `b0 × ln(끝 BPM ÷ 시작 BPM)`을 써서 어긋납니다. 이 설계서를 쓰면서 두 식을 직접 계산해 보니, 16마디 동안 140→200으로 빨라지는 구간에서 지금 식은 최대 5,945틱 어긋나고 새 식은 오차가 사실상 0(10⁻¹¹틱)입니다. 속성 테스트로 "아무 위치 t에서나 `secondsToTicks(ticksToSeconds(t))`와 t의 차이 < 0.5틱"을 확인합니다.
- 늘임표: 모델에 이미 있는 `Fermata.tempoScale`(기본 0.75)을 씁니다. 해당 박(`beatTick`) 동안 템포에 `tempoScale`을 곱한 짧은 구간을 템포 지도에 넣습니다(0.75면 그 박이 약 1.33배 길어짐).
- 셋잇단 느낌(`MasterBar.tripletFeel`, 지금 값 "8th swing"): 재생할 때만 박 안의 위치를 바꿉니다. 8분 느낌은 4분음표 박 안의 둘째 8분음표 시작을 박의 1/2에서 2/3 지점으로 옮기고 길이를 2:1로 나눕니다. 16분 느낌은 8분음표 단위로 같은 규칙입니다. 격자에 맞지 않는 음은 그대로 둡니다(spec 03: 재생에만 영향).
- 그 밖의 표현:
  - simile(마디 반복 기호): 앞 마디(두 마디 기호는 앞 두 마디)의 내용을 재생합니다.
  - 브러시·아르페지오: 화음의 음을 `speed`와 `direction`에 따라 차례로 늦춰 냅니다.
  - 트릴: `trill.secondFret` 음과 번갈아 냅니다.
  - 점점 세게·여리게(`dynamicHairpin`): 구간 동안 벨로시티를 보간합니다.
  - 자연 하모닉스: 지금 `harmonicPitchShift`(compile.ts 316행)는 누른 프렛에 +12를 더해 12프렛 하모닉스가 한 옥타브 높게 납니다. 소리는 "개방현 + 하모닉스 위치별 음정"입니다: 12프렛 +12, 7·19프렛 +19, 5·24프렛 +24, 4·9·16프렛 +28.

**R5-6. 드럼 소리 (B4 소리)**

- `src/engine/audio/drumSynth.ts`(신규): 샘플 없이 합성합니다. GM 타악기 번호별로 킥(35·36: 사인파 음높이를 빠르게 내림), 스네어(38·40: 잡음 + 짧은 톤), 사이드스틱(37), 하이햇 닫힘·페달·열림(42·44·46: 고음 통과 잡음, 길이 차이. 닫힘이 오면 열림을 끊음), 탐(41~50: 사인파), 크래시·라이드·차이나(49·51·52: 긴 잡음 + 대역 필터).
- 트랙 종류가 percussion(R4-0)이면 오실레이터 대신 이 합성기로 보냅니다. 소리 품질은 R5-B 샘플로 올립니다.

**R5-7. 구간 반복, 화면 따라가기, 메트로놈 (B5 나머지)**

- 구간 반복: 앞으로 0.2초를 미리 예약하는 창이 구간 끝을 넘으면, 넘는 부분을 구간 처음 시간에 이어 붙여 예약합니다. 끊김 없이 반복되고, 곡 끝에서만 반복하던 지금 동작(usePlaybackController.ts 100행)을 대신합니다.
- 화면 따라가기: 재생 위치(편집할 때는 커서)가 보이는 영역 가장자리 15% 안으로 들어오면 부드럽게 스크롤합니다. 사용자가 직접 스크롤하면 3초 동안 따라가기를 멈춥니다.
- 메트로놈·예비박: 박자표의 박 단위로 클릭합니다. 6/8·9/8·12/8은 점4분음표마다, 첫 박은 강세. 예비박은 첫 마디의 박자표로 한 마디입니다.

**R5-8. LCD 템포 (C4)**

- `EditorShell.tsx` 442행의 고정 문자열 "♩ 120"을 지우고, 재생 중에는 재생 위치의, 멈춰 있을 때는 커서 위치의 템포를 템포 지도에서 읽어 보여 줍니다. 클릭하면 숫자를 입력할 수 있고, 입력하면 그 마디 시작에 템포 자동화 지점을 추가하거나 고칩니다.

**R5-B(선택). 사운드폰트**

- 샘플 재생기 `src/engine/audio/samplePlayer.ts`(신규): 악기별로 몇 반음 간격으로 녹음된 소리를 불러와 재생 속도로 음높이를 맞춥니다. 출력은 R5-2의 트랙 버스 입력으로 연결하므로 구조는 바뀌지 않습니다.
- 소리 출처: FluidR3 GM 사운드폰트(제작자 Frank Wen, MIT 라이선스)에서 필요한 악기만 뽑아 `public/sounds/`에 둡니다(스틸·나일론 기타, 클린·오버드라이브·디스토션 기타, 핑거 베이스, 피아노, 드럼). 인터넷에 미리 변환해 둔 FluidR3_GM 세트(gleitz의 midi-js-soundfonts)는 CC BY 3.0으로 배포되어 출처 표기가 필요하고, MusyngKite 세트는 CC BY-SA 3.0(같은 조건으로 공개할 의무)이라 쓰지 않습니다. 재생 라이브러리는 smplr(MIT)를 쓰거나 직접 만듭니다.
- 용량 예산은 전체 8MB 이하이고, 곡에 쓰인 악기만 필요할 때 내려받아 브라우저 캐시에 둡니다.
- 첫 재생: 소리를 다 받기 전에는 "소리를 불러오는 중"을 보여 주고, 다 받은 뒤 시작합니다. 같은 프로젝트의 MuseScore 카피 점검에서 첫 재생만 대체 합성음으로 나오던 문제가 있었기 때문입니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R5-a | 재생 상태 기계·세션 번호·끊김 없는 seek(R5-1) |
| R5-b | 트랙 버스 구조, 기본 효과 끄기, 음량 조정, 볼륨 단위 통일(R5-2) |
| R5-c | 믹서 데이터 v5, 즉시 반영, V와 소리 분리(R5-3) |
| R5-d | `unrollScore` 재작성 + 순서 표 테스트(R5-4) |
| R5-e | 템포 역변환, 늘임표, 셋잇단 느낌, 표현, 하모닉스, LCD(R5-5, R5-8) |
| R5-f | 드럼 합성, 구간 반복, 화면 따라가기, 메트로놈(R5-6, R5-7) |

#### 재현 테스트

- `[A7]` 재생 중 `Ctrl+→` 뒤에도 상태가 playing / Space로 정지 / 이전 세션의 신호는 무시(단위)
- `[A8]` 데모 렌더의 최대값 ≤ −1 dBFS, 한계치 이상 구간 0초(소리 테스트) / 볼륨 자동화 1.2가 0.0001로 떨어지지 않음
- `[B2]` 위 순서 표 / 늘임표 박의 길이가 1 ÷ `tempoScale`배 / 셋잇단 느낌의 둘째 8분음표가 2/3 지점에서 시작 / 12프렛 자연 하모닉스 = 개방현 + 12
- `[B3]` 왕복 오차 0.5틱 미만(속성 테스트)
- `[B4]`(소리) 드럼 트랙 이벤트가 드럼 합성기로 가고, 음높이 오실레이터를 만들지 않음
- `[B5]` 재생 중 음소거 → 0.05초 안에 그 트랙 출력 0 / 믹서 설정이 저장 후 다시 열어도 같음 / V를 꺼도 소리는 남 / 구간 반복이 구간 끝에서 반복 / 6/8 메트로놈 간격 = 점4분음표
- `[C4]` LCD 템포 = 템포 지도의 값

소리 테스트 도구 `src/test/audio/`(신규): Playwright 페이지 안에서 `OfflineAudioContext`로 앱의 소리 구조를 그대로 렌더하고 최대값·RMS·한계치 초과 시간을 계산합니다. 이번 점검에서 쓴 측정 방법을 정식 테스트로 만든 것입니다.

#### 완료 기준

- [ ] 위 테스트가 통과한다.
- [ ] 100마디×8트랙에서 재생해도 소리가 끊기지 않는다(재생 중 화면 갱신이 50ms를 넘는 구간 0회, R8과 함께 측정).
- [ ] 성태 님이 이어폰으로 데모곡을 듣고 찌그러짐이 없다고 확인했다.

#### 직접 확인

1. 이어폰을 끼고 데모곡을 재생합니다. 찌그러지거나 지직거리는 소리가 없는지 듣습니다.
2. 재생 중 `Ctrl+→`(또는 도구줄의 > 버튼)를 누릅니다. 재생 버튼이 "재생 중" 모양으로 남는지, Space로 멈추는지 봅니다.
3. 재생 중 기타 트랙의 M(음소거)을 눌러 바로 소리가 빠지는지 듣습니다.
4. 믹서에서 볼륨을 바꾸고 저장한 뒤 다시 열어 그대로인지 봅니다.
5. 드럼 트랙이 있으면 드럼 소리로 들리는지 듣습니다.
6. 구간 반복을 켜고 2~3마디를 선택해 재생합니다. 3마디 끝에서 2마디로 돌아가는지 봅니다.
7. LCD에 곡의 실제 템포가 나오는지, 숫자를 바꾸면 빨라지거나 느려지는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| 브라우저마다 Web Audio 동작이 조금씩 다름 | 소리 테스트는 크롬 기준. Safari·Firefox는 R9 끝에 수동 확인 |
| 합성 드럼 소리가 단순함 | 기능 확인용. 품질은 R5-B 샘플로 |
| 점프 뒤 도돌이 반복 여부가 곡마다 다를 수 있음 | 기본은 반복하지 않음. 곡별 설정은 나중 과제로 기록 |

#### AI 프롬프트 (R5)

```text
[R5 재생]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 A7, A8, B2, B3, B4(소리), B5, C4. 설계서 R5-1 ~ R5-8 (R5-B는 별도 지시 전까지 하지 않음). PR 6개.
먼저 읽을 것: src/engine/audio/{scheduler,sampler,compile,mixer,tempoMap}.ts, src/engine/unroll/unrollScore.ts,
  src/app/controllers/usePlaybackController.ts, src/store/playbackStore.ts, src/model/types.ts,
  specs/03-기보법-심볼과-이펙트.md(도돌이·괄호·점프·셋잇단 느낌 규칙)
R5-a: transport.ts 상태 기계, sessionId, 끊김 없는 seek, Space는 getState()로 판단.
R5-b: audioGraph.ts(트랙 버스·마스터 리미터), 음마다 효과를 만들지 않음, 기본 효과 끔,
      faderToGain 단일화, src/test/audio/ 렌더 측정 도구와 [A8] 테스트.
R5-c: Track.mix·Score.masterMix(스키마 v5 + 볼륨 값 변환), buildNoteMix 제거, 즉시 반영, V 분리, 손을 뗄 때 실행취소 한 단계.
R5-d: unrollScore를 설계서의 의사 코드대로 재작성하고 순서 표를 테스트로.
R5-e: secondsToTicks를 설계서 식으로, 속성 테스트, 늘임표(tempoScale), 셋잇단 느낌, simile·브러시·트릴·헤어핀,
      하모닉스 표, LCD 템포(EditorShell의 "♩ 120" 제거).
R5-f: drumSynth.ts, 구간 반복 이어 붙이기, 화면 따라가기, 박자표 기준 메트로놈·예비박.
금지: 레이아웃·오선보 변경, 소리 파일(샘플) 추가.
```

### R6. 파일(MusicXML·MIDI·PDF·PNG·SVG·ASCII)

- **목표:** 다른 프로그램과 악보를 주고받을 수 있게 합니다.
- **끝나면 달라지는 점:**
  - MusicXML로 내보낸 파일을 다시 열면 원래 악보와 같습니다(지원 범위 안). 다른 프로그램에서 만든 MusicXML도 음높이·화음·리듬이 맞게 열리고, 압축된 `.mxl`도 열립니다.
  - 내보낸 MIDI가 다른 프로그램에서 열리고 악기·템포 변화가 맞습니다. MIDI를 가져오면 화음과 쉼표가 살아 있습니다.
  - PDF가 화면과 같은 모양(악보 기호·한글 포함)으로 나오고, 인쇄해도 악보만 깔끔하게 나옵니다.
  - PNG는 모든 페이지를 원하는 해상도로, SVG는 악보 글꼴이 없는 PC에서도 같은 모양으로 저장됩니다.
  - ASCII 탭이 80자 폭으로 줄바꿈되고 리듬 간격이 반영됩니다.
  - 새벽에 저장해도 파일 이름의 날짜가 맞습니다.
- **다루는 항목:** B13, B14, B15, C10, C11
- **크기:** 큼(PR 7개)

#### 설계

**R6-1. 지원 범위 표와 왕복 기준**

- `docs/refactoring/io-support.md`(신규)에 형식별로 무엇을 읽고 쓰는지 표로 적습니다(음높이, 리듬, 점, 잇단음, 성부, 화음, 붙임줄, 도돌이·괄호·점프, 템포, 박자·조, 줄·프렛, 효과 일부). 테스트는 이 표를 기준으로 합니다.
- 왕복 테스트의 기준은 "내보내기 → 가져오기 뒤 정규화한 악보가 같다"입니다(ID와 화면 설정은 비교에서 뺍니다).
- 가져오기에서 지원하지 않는 요소를 만나면 버리지 말고 개수를 세어 "지원하지 않는 요소 N개를 건너뛰었습니다"로 알려 줍니다.

**R6-2. MusicXML (B13)**

- 파일 구조: `src/io/musicXml/import.ts`, `export.ts`, `mxl.ts`(모두 신규). 기존 `src/io/musicXml.ts`는 지웁니다.
- 지금 문제의 원인: `<note>`를 정규식으로 찾아(189행) 속성이 붙은 `<note ...>`를 놓치고, 박자 값이 없으면 `Number(textBetween(...))`(168~170행)가 0이 되어 0/0 박자가 생깁니다. 음높이는 읽지 않고 줄·프렛만 읽으며(201~203행), 내보내기는 성부 1만 씁니다(126행).
- 가져오기는 XML 해석기를 씁니다. 앱에서는 브라우저의 `DOMParser`(추가 용량 없음), 테스트에서는 Vitest의 jsdom 환경(`// @vitest-environment jsdom`, jsdom을 개발 의존성으로 추가). `.mxl`(ZIP)은 fflate(MIT)로 풀어 `META-INF/container.xml`이 가리키는 파일을 읽습니다.

| MusicXML 요소 | 쓰임 |
|---|---|
| `part-list/score-part`, `midi-instrument` | 트랙 이름, 악기(GM 프로그램) |
| `attributes`: `divisions`, `key`(fifths, mode), `time`(beats, beat-type), `clef`, `staff-details`(staff-lines, staff-tuning, capo), `transpose` | 박자·조·음자리표·튜닝·이조. 값이 없으면 앞 값을 유지 |
| `note`: `pitch`(step, alter, octave) / `rest` / `unpitched`, `duration`, `type`, `dot`, `time-modification`, `chord`, `voice`, `staff` | 음높이·리듬·화음·성부 |
| `note/notations`: `technical`(string, fret, hammer-on, pull-off, bend), `tied`, `slur`, `articulations`, `ornaments` | 줄·프렛·효과·붙임줄 |
| `backup`, `forward` | 성부 사이의 시간 이동 |
| `barline`: `repeat`(direction, times), `ending`(number, type) | 도돌이·괄호 |
| `direction`: `segno`, `coda`, `words`(Fine, D.C., D.S., To Coda), `sound`(tempo, dacapo, dalsegno, fine, tocoda) | 점프·템포 |
| `harmony` | 코드 이름 |

- 처리 규칙: 시간 위치는 `divisions` 기준 누적값을 480틱으로 환산합니다. `chord` 표시가 있는 음은 앞 음과 같은 박으로 묶습니다. 성부는 나오는 순서대로 1~4에 배정하고, 다섯째 성부부터는 경고 후 4에 합칩니다. 박 사이의 빈 시간은 쉼표로 채웁니다. 리듬은 `type`·`dot`·`time-modification`을 먼저 쓰고, 없으면 `duration`으로 계산합니다.
- 줄·프렛: `technical`의 string·fret이 있으면 그대로 쓰고, 없으면 R4의 배치 함수로 정합니다. 튜닝은 `staff-tuning`이 있으면 그대로, 없으면 줄 수에 맞는 표준 튜닝(4·5줄이면 베이스)으로 합니다.
- 내보내기는 위 요소를 모두 씁니다(음높이, 모든 성부, 점, 잇단음, 붙임줄, 도돌이·괄호·점프, 템포, 튜닝).
- 픽스처: 직접 작성한 MusicXML 6개(속성이 붙은 note, 화음, backup을 쓰는 2성부, 점·셋잇단, 도돌이·괄호, D.S. al Coda)와 왕복 테스트.

**R6-3. MIDI (B14)**

- 파일 구조: `src/io/midi/import.ts`, `export.ts`(신규). 바이트를 직접 쓰지 않고 `midi-file`(MIT)의 `parseMidi`·`writeMidi`를 씁니다. 지금의 판독 거부는 템포 트랙 이름의 길이 바이트를 6으로 적어 놓고 "Tempo" 다섯 글자만 쓴 데서 나옵니다(midi.ts 19행).
- 내보내기 규칙
  - 형식 1(여러 트랙). 첫 트랙은 템포 트랙: 모든 템포 지점(FF 51), 박자표 변화(FF 58), 조표 변화(FF 59). 템포 램프는 16분음표마다 템포 이벤트로 나눕니다. 지금은 첫 템포 하나만 씁니다.
  - 악기 트랙: 트랙 이름(UTF-8), 틱 0에 프로그램 체인지, 그다음 음. 같은 틱 안에서는 메타 → 프로그램·컨트롤 → 노트오프 → 노트온 순서로 씁니다(지금은 상태 바이트 크기 순으로 정렬해서 노트온이 프로그램 체인지보다 먼저 나옴, 123행).
  - 프로그램 번호: 악기 정의의 GM 번호는 이미 0부터 세는 값이므로 1을 빼지 않습니다(지금 `gmProgramForTrack`, 254~256행에서 1을 빼서 플루트가 피콜로가 됨).
  - 채널: 타악기 트랙은 10번 채널(0부터 세면 9), 나머지는 9를 건너뛰며 배정하고, 15개를 넘으면 같은 악기끼리 나눠 씁니다.
  - 도돌이표를 펼친 재생 순서(R5)로 씁니다. "펼치지 않고 내보내기"는 선택 사항으로 둡니다.
  - 붙임줄로 이은 음은 하나의 긴 음으로 씁니다(R2).
- 가져오기 규칙
  - 같은 트랙에서 시작 시간이 같은(±10틱) 음은 한 박의 화음으로 묶습니다.
  - 박자 격자에 맞추기: 기본은 16분음표이고, 셋잇단을 감지할지 사용자가 고릅니다.
  - 빈 시간은 쉼표로, 마디 경계를 넘는 음은 나눠서 붙임줄로 잇습니다.
  - 10번 채널은 타악기 트랙(`midiNumber`)으로, 나머지는 음높이로 받아 현악기 트랙이면 R4의 배치 함수로 줄·프렛을 정합니다(`midiPitch`는 저장하지 않음, R4-0 규칙).
  - 템포·박자·조 메타 이벤트는 마스터 마디와 템포 자동화로 옮깁니다.

**R6-4. PDF와 인쇄 (B15, C10)**

- 방식은 브라우저 인쇄 기능을 거쳐 PDF로 저장하는 것입니다(2.2). "내보내기 → PDF"를 누르면 다음이 일어납니다.
  1. 인쇄 전용 보기 `src/io/print/PrintView.tsx`(신규)가 모든 페이지를 SVG로, 실제 용지 크기(mm)로 그립니다.
  2. 인쇄 CSS(`src/ui/styles/print.css`, 지금 9줄)가 `@page { size: A4 portrait; margin: 0 }`(스타일시트의 용지·방향 값으로 채움)를 정하고, 편집기 화면 요소를 숨기고, 페이지마다 나눕니다(`break-after: page`).
  3. `window.print()`를 호출하고 "프린터(대상)를 'PDF로 저장'으로 고르세요"라는 안내를 보여 줍니다.
- 악보 글꼴(웹 글꼴)과 한글 글꼴이 그대로 들어가므로 "?"로 나오던 문제가 사라집니다.
- 단점은 버튼 한 번에 파일이 바로 생기지 않고 인쇄 창을 거친다는 점입니다. 버튼 한 번으로 바로 저장하는 기능은 나중 과제입니다(jsPDF와 svg2pdf.js, 둘 다 MIT. jsPDF는 넣을 수 있는 글꼴 형식에 제약이 있어 악보 기호를 윤곽선으로 바꾸는 작업이 필요할 수 있음).
- PDF 명령을 직접 쓰던 지금의 `src/io/pdfExport.ts`(path를 건너뛰고, 투명 사각형을 검게 칠하고, ASCII 밖 문자를 "?"로 바꿈)는 지웁니다.
- 확인 테스트: Playwright의 `page.pdf()`(크롬에서만 동작)로 인쇄 결과를 PDF로 만들어 페이지 수가 악보 페이지 수와 같은지, 각 페이지에 제목(한글 포함)이 글자로 들어 있는지 확인합니다.

**R6-5. PNG와 SVG (B15)**

- SVG 내보내기: 악보 기호를 글꼴 문자 대신 윤곽선(path)으로 바꿔 넣습니다. 내보낼 때만 opentype.js(MIT)로 Bravura 글리프 윤곽을 꺼냅니다. 글꼴이 없는 PC에서도 같은 모양이 됩니다. 여러 페이지는 페이지별 파일을 ZIP으로 묶습니다(fflate).
- PNG: 페이지마다 SVG → 캔버스(배율 1·2·3배, 기본 2배) → PNG, 여러 페이지면 ZIP. 지금은 첫 페이지만 1배로 나옵니다.

**R6-6. ASCII 탭 (B15)**

- 줄 폭 기본 80자(설정 가능), 마디 단위로 줄바꿈합니다(마디 하나가 폭보다 길면 그 마디만 넘침).
- 리듬 간격: 가장 짧은 음을 1칸으로 놓고 길이에 비례해 칸을 줍니다(16분음표가 가장 짧으면 8분음표 2칸, 4분음표 4칸). 두 자리 프렛은 칸을 넓힙니다.
- 줄 앞에 튜닝 글자(`e|`, `B|` …), 마디마다 `|`. 가져오기는 R1-2의 묶음 단위 읽기와 짝을 이룹니다.

**R6-7. 파일 이름 날짜 (C11)**

- `exportNames.ts`의 날짜를 `toISOString().slice(0, 10)`(세계 표준시 날짜)에서 현지 날짜로 바꿔 시각과 같은 기준으로 맞춥니다. 테스트는 시간대를 Asia/Seoul로 고정하고 새벽 2시 사례를 씁니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R6-a | 지원 범위 표, 왕복 비교 도우미, MusicXML 가져오기(R6-1, R6-2) |
| R6-b | MusicXML 내보내기, `.mxl`(R6-2) |
| R6-c | MIDI 내보내기(R6-3) |
| R6-d | MIDI 가져오기(R6-3) |
| R6-e | 인쇄 보기·인쇄 CSS·PDF, 옛 `pdfExport.ts` 삭제(R6-4) |
| R6-f | SVG 윤곽선·PNG 여러 페이지(R6-5) |
| R6-g | ASCII 탭, 파일 이름 날짜(R6-6, R6-7) |

#### 재현 테스트

- `[B13]` 데모 → MusicXML → 가져오기 결과가 원본과 같음(0/0 박자 없음, NaN 좌표 0개, 점·잇단음·2성부·도돌이·베이스 튜닝 유지) / 속성 있는 note, 화음, 음높이만 있는 파일을 바르게 읽음
- `[B14]` 내보낸 파일을 `midi-file`과 `@tonejs/midi`(MIT, 개발 의존성) 두 판독기가 모두 읽음 / 플루트가 0부터 세어 73번으로 왕복 / 템포 지점 3개가 모두 들어감 / 노트온이 프로그램 체인지 뒤에 옴 / 가져오기에서 화음·쉼표 유지 / 가져온 음의 프렛을 바꾸면 음높이도 바뀜
- `[B15]` `page.pdf()` 결과의 페이지 수와 한글 제목 / PNG 모든 페이지·배율 / SVG에 악보 글꼴 문자 대신 path / ASCII 80자 줄바꿈
- `[C10]` 인쇄 결과에 편집기 버튼·패널이 없음
- `[C11]` 한국 시간 새벽 2시에 저장한 파일 이름의 날짜가 그날

#### 완료 기준

- [ ] 위 테스트가 통과한다.
- [ ] `docs/refactoring/io-support.md`와 테스트가 일치한다.
- [ ] 옛 `musicXml.ts`, `midi.ts`, `pdfExport.ts`를 지웠다.

#### 직접 확인

1. 데모곡을 MusicXML로 내보낸 뒤 다시 가져와, 박자표·점·셋잇단·도돌이가 원래와 같은지 봅니다.
2. 다른 악보 프로그램에서 내보낸 MusicXML이 있으면 열어 음높이와 화음이 맞는지 봅니다.
3. MIDI로 내보내 다른 프로그램(음악 재생기나 작곡 프로그램)에서 열리는지, 악기가 맞게 들리는지 확인합니다.
4. 내보내기 → PDF → 인쇄 창에서 'PDF로 저장'을 고르고, 저장한 PDF에서 악보 기호와 한글 제목이 그대로인지 봅니다.
5. PNG로 저장해 모든 페이지가 나오는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| MusicXML은 작성 프로그램마다 쓰는 방식이 다양함 | 지원 범위 표로 범위를 정하고, 지원하지 않는 요소는 개수를 알려 줌 |
| 인쇄 창의 모양이 브라우저마다 다름 | 크롬 기준으로 안내 문구를 쓰고, 다른 브라우저는 R9 끝에 수동 확인 |
| 펼친 MIDI가 원래 악보보다 길어짐 | 펼치지 않는 선택 사항 제공 |

#### AI 프롬프트 (R6)

```text
[R6 파일]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 B13, B14, B15, C10, C11. 설계서 R6-1 ~ R6-7. PR 7개(R6-a ~ R6-g).
먼저 읽을 것: src/io/{musicXml,midi,pdfExport,vectorExport,asciiTab,exportNames,fileFormat}.ts,
  src/app/controllers/useFileController.ts, src/ui/styles/print.css, specs/05-파일-임포트-익스포트.md,
  src/model/trackKind.ts(R4의 음높이 규칙), src/engine/unroll/unrollScore.ts(R5)
의존성 추가: jsdom(개발), fflate, midi-file, @tonejs/midi(개발), opentype.js. 추가 이유와 라이선스를 PR에 적는다.
R6-a/b: MusicXML 가져오기·내보내기·.mxl을 DOMParser 기반으로 새로 작성하고 옛 musicXml.ts 삭제. 왕복 테스트와 픽스처 6개.
R6-c/d: midi-file 기반 내보내기·가져오기(설계서의 순서·채널·프로그램 번호·화음 묶기 규칙). 판독기 2종 테스트.
R6-e: PrintView + print.css + window.print 경로, pdfExport.ts 삭제, page.pdf 확인 테스트.
R6-f: SVG 내보내기에서 글리프를 path로, PNG 여러 페이지·배율.
R6-g: ASCII 탭 줄바꿈·리듬 간격, 파일 이름 현지 날짜.
금지: 악보 모델 구조 변경(필요하면 보고), 재생 순서 규칙 변경.
```

### R7. 도구

- **목표:** 코드·스케일·조옮김·튜닝 변경·정리 도구·튜너가 정확한 결과를 내고, 여러 마디를 복사할 수 있게 합니다.
- **끝나면 달라지는 점:**
  - "Am"은 A단조, "Am7"은 A마이너7으로 인식됩니다.
  - 스케일 목록에 중복이 없고, 이름과 음이 맞습니다.
  - 조옮김이 개방현도 제대로 옮기고, 온음계 조옮김이 조 안에서 움직입니다.
  - 튜닝을 바꿔도 한 줄에 두 음이 겹치지 않고, 정리 도구가 음을 망가뜨리지 않습니다.
  - 여러 마디를 골라 복사하고 붙여 넣을 수 있습니다.
  - 튜너가 옥타브를 틀리지 않고 베이스 저음도 잡으며, 마이크가 없으면 안내가 나옵니다.
  - 튜닝을 음 이름(E2, A2 …)으로 고릅니다.
- **다루는 항목:** B6, B7, B8, B9, B17, B19, C14
- **크기:** 중간(PR 5개)

#### 설계

**R7-1. 코드 이름 해석 (B6)**

- 원인: `chords.ts`의 `qualityFromText`(285행)가 대소문자를 무시하고 비교해, 소문자 m(단조)과 대문자 M(장7)을 같은 것으로 봅니다.
- 대소문자를 구분하는 해석기로 다시 씁니다.

```text
코드   = 근음 [품질] [확장] [변화…] [추가] ["/" 베이스음]
근음   = A~G [# | b]
품질   = "m" | "min" | "-"        → 단조
       | "M" | "maj" | "Δ"         → 장7 계열(뒤에 7·9·11·13)
       | "dim" | "°" | "o"         → 감
       | "aug" | "+"               → 증
       | "sus2" | "sus4" | "sus"   → 서스
       | "ø" | "m7b5"              → 반감7
확장   = "6" | "7" | "9" | "11" | "13" | "69"
변화   = ("b" | "#") ("5" | "9" | "11" | "13")
추가   = "add" ("9" | "11" | "13")
```

- 표 기반 단위 테스트 약 40개로 구성음을 확인합니다. 예: Am, Am7, AmMaj7, Amaj7, AM7, A7, A-7, Am7b5, Aø, Adim7, A°7, Aaug, A+, Asus4, A7sus4, A9, Am9, A6, Am6, A69, Cadd9, C/G, F#m7, Bb7#9, E7b9, D13.

**R7-2. 스케일 (B7)**

- 스케일을 "음 집합"(12칸 비트 표시)으로 나타내고, 같은 음 집합이면 하나만 남깁니다. 자동으로 "변형"을 만들어 내던 `mutateIntervals`(scales.ts 143행)는 없앱니다.
- 목록은 명세(specs/06)의 스케일 목록을 기준으로 직접 정한 것만 둡니다(장음계와 일곱 선법, 화성·가락 단음계와 그 선법, 5음계, 블루스, 온음계, 감음계 등). "이름 → 음정" 표를 문서에 남기고, 테스트로 "같은 음 집합 중복 0개", "이름별 음정이 표와 같음"을 확인합니다.

**R7-3. 조옮김 (B8)**

- 반음 조옮김(`transpose.ts`의 `transposeScore`): 음마다 목표 음높이 = 지금 + n. 현악기는 같은 줄에서 0~최대 프렛이면 그 줄을 쓰고, 아니면 같은 박에서 비어 있는 줄 중 손 위치가 가장 가까운 줄로 옮깁니다. 지금은 `Math.max(0, fret + n)`이라 개방현은 내려가지 않습니다. 옮길 수 없는 음은 그대로 두고 "음 3개는 이 튜닝 범위 밖이라 옮기지 못했습니다"처럼 알려 줍니다.
- 선택 사항 "조표도 함께 바꾸기": 조표를 n반음만큼 옮깁니다(5도권 기준, 7개를 넘으면 같은 소리의 다른 이름 조로).
- 온음계 조옮김: 음을 조 안의 단계(+ 변화량)로 바꿔 k단계 옮긴 뒤 다시 음높이로 바꿉니다. 조 밖의 음은 변화량을 유지합니다. 지금은 반음 조옮김과 결과가 같습니다.
- 코드 이름도 같은 양만큼 옮깁니다(`transposeChordSymbol`이 이미 있음).

**R7-4. 튜닝 변경과 정리 도구 (B9)**

- 다시 배치하기(`retuneTrack`의 `"adjust-fingering"`): 박마다 "음 → 줄" 배정 문제로 풉니다. 음 개수가 줄 수(최대 10) 이하라 가지치기 탐색으로 모든 경우를 빠르게 따질 수 있습니다. 비용 = 프렛 높이의 합 + 앞 박 손 위치와의 거리 × 가중치이고, 한 줄에 한 음만 둡니다. 같은 튜닝으로 바꾸면 아무것도 바뀌지 않아야 합니다(테스트).
- "Fingers"(`scoreCrudHandlers.ts`의 `handleCleanupRequest`, 526행): 12프렛을 넘는 음을 12프렛 내려 음높이가 바뀌는 지금 동작을 없애고, 위의 배치 계산으로 "같은 음높이를 더 낮은 프렛에서 칠 수 있으면 옮기기"로 바꿉니다.
- "Rests"(같은 함수, 532행): 빈 길이를 박 경계를 지키는 여러 쉼표로 채웁니다. 현재 위치에서 시작할 수 있고(박 단위로 정렬) 남은 길이 이하인 가장 큰 쉼표를 반복해서 고르며, 4/4에서는 마디 가운데(2박 경계)를 넘는 쉼표를 쓰지 않습니다. 예: 4/4 첫 박 뒤 1440틱이 비면 4분쉼표(2박) + 2분쉼표(3~4박). 지금은 가장 가까운 쉼표 하나(온쉼표)를 넣어 마디가 넘칩니다.

**R7-5. 범위 복사·붙여넣기 (B17)**

- 선택 범위: 이미 있는 `SelectionRange`(anchor·head)를 "마디 범위 × 트랙들 × (선택) 박 범위"로 해석합니다. `Shift+←/→`로 넓히고, 마우스로 끌어서 고르는 것도 같은 모델을 씁니다.
- 복사: 선택 범위를 직렬화해서 앱 안 클립보드와 시스템 클립보드(텍스트, 앱 전용 머리표를 붙임)에 함께 넣습니다.
- 붙여넣기: 커서 위치부터 덮어쓰기(기본) 또는 끼워 넣기. 마지막 마디를 넘으면 모든 트랙에 마디를 늘려 `bars-count` 불변식을 지킵니다. "특수 붙여넣기"는 반복 횟수, 끼워 넣기 여부, 음만·효과만을 고르는 창입니다(지금은 두 번 붙여넣기와 같음).

**R7-6. 튜너 (B19)**

- `tuner.ts`의 `detectPitchFromBuffer`(정수 단위 지연에서 최댓값만 고름)를 `pitchy`(MIT, McLeod 방식)로 바꿉니다.
- 설정: 입력 길이 4096샘플(48kHz에서 약 85ms. 5현 베이스 B0(30.9Hz)의 한 주기 약 1,555샘플을 두 번 이상 담음), 명료도(clarity) 0.9 미만은 버림, 최근 5개 값의 중앙값으로 흔들림을 줄임.
- 마이크: `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. 권한 거부(`NotAllowedError`), 장치 없음(`NotFoundError`), 다른 앱이 사용 중(`NotReadableError`)마다 안내 문구와 [다시 시도] 버튼을 보여 줍니다.

**R7-7. 튜닝 입력 (C14)**

- 줄마다 음 이름(E2 등)을 고르고 반음 ± 버튼으로 바꿉니다. 내부 값은 지금처럼 MIDI 번호입니다. 악기별 프리셋만 보여 줍니다(지금은 첼로에 비올라 프리셋이 함께 나옴).

#### 작업 순서

| PR | 내용 |
|---|---|
| R7-a | 코드 해석기, 스케일 목록(R7-1, R7-2) |
| R7-b | 반음·온음계 조옮김(R7-3) |
| R7-c | 줄 배정 계산, Fingers·Rests 정리 도구(R7-4) |
| R7-d | 범위 선택·복사·붙여넣기·특수 붙여넣기(R7-5) |
| R7-e | 튜너, 튜닝 입력(R7-6, R7-7) |

#### 재현 테스트

- `[B6]` 코드 표 40개
- `[B7]` 같은 음 집합 중복 0개 / 이름별 음정이 표와 같음
- `[B8]` 개방현이 포함된 Em 코드를 −2 → 모든 음이 정확히 2반음 낮음 / C장조 온음계 +2단계: E → G
- `[B9]` 같은 튜닝으로 다시 배치하면 변화 없음 / Fingers 뒤 음높이가 그대로 / 4/4 첫 박 뒤 1440틱 → 4분쉼표 + 2분쉼표
- `[B17]` 2~4마디 복사 후 붙여넣기 → 같은 3마디 / 마지막 마디 뒤 붙여넣기 → 모든 트랙의 마디 수가 같음
- `[B19]` 합성 신호(배음이 섞인 파형 포함)로 B0, E1(41.2Hz)~E4를 ±2센트 안으로 / 마이크 거부 시 안내 문구
- `[C14]` 튜닝 창이 음 이름으로 표시

#### 완료 기준

- [ ] 위 테스트가 통과한다.
- [ ] 도구 창의 모든 버튼이 동작하거나, 동작하지 않는 것은 숨겨져 있다.

#### 직접 확인

1. 코드 도구에 Am을 입력해 구성음이 A·C·E로 나오는지 봅니다.
2. 개방현이 들어간 Em 코드를 2반음 내려 D단조 모양이 되는지 봅니다.
3. 2~4마디를 `Shift+→`로 고르고 `Ctrl+C` → 마지막 마디로 가서 `Ctrl+V` → 그대로 붙고 다른 트랙도 마디가 함께 늘어나는지 봅니다.
4. 튜너를 켜고 기타 줄을 튕겨 음 이름이 맞는지 봅니다(실제 마이크 필요).
5. 튜닝 창에서 줄 음이 E2 같은 이름으로 보이는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| 코드 표기법이 사람마다 다름 | 문법을 문서로 고정하고, 해석할 수 없는 이름은 "인식할 수 없는 코드"로 표시 |
| 스케일 목록이 줄어 보임 | 중복 제거 전후 개수와 사라진 이름 목록을 PR에 첨부 |
| 실제 마이크 환경의 잡음 | 명료도 기준값과 중앙값 필터를 설정으로 노출, 실제 확인은 성태 님 |

#### AI 프롬프트 (R7)

```text
[R7 도구]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 B6, B7, B8, B9, B17, B19, C14. 설계서 R7-1 ~ R7-7. PR 5개(R7-a ~ R7-e).
먼저 읽을 것: src/model/{chords,scales,tuner,instruments}.ts, src/engine/tools/transpose.ts,
  src/app/controllers/{scoreCrudHandlers,useEditorController}.ts(복사·붙여넣기·정리 도구),
  src/engine/editing/types.ts, src/ui/shell/{ToolPanels,TrackSystemPanels}.tsx, specs/06-도구와-부가기능.md
의존성 추가: pitchy(MIT).
R7-a: 대소문자를 구분하는 코드 해석기(설계서 문법) + 표 테스트 40개, 스케일 음 집합 중복 제거와 목록 정리.
R7-b: 줄을 바꿔 가며 옮기는 반음 조옮김, 온음계 조옮김, 옮기지 못한 음 개수 안내.
R7-c: 박 단위 줄 배정 탐색, retuneTrack adjust-fingering 교체, Fingers·Rests 재작성.
R7-d: 범위 선택(Shift+화살표·마우스 끌기), 범위 복사·붙여넣기, 특수 붙여넣기 창.
R7-e: pitchy 튜너(4096샘플, clarity 0.9, 중앙값 5개), 마이크 오류 안내, 음 이름 튜닝 입력.
금지: 레이아웃·재생 변경.
```

### R8. 성능

- **목표:** 큰 악보에서도 편집과 커서 이동이 바로 반응하고, 편집할수록 메모리가 계속 늘어나지 않게 합니다.
- **끝나면 달라지는 점:**
  - 100마디×8트랙에서도 입력이 0.05초 안에 화면에 나타나고, 커서가 끊김 없이 움직입니다.
  - 큰 악보를 재생해도 화면과 소리가 버벅이지 않습니다.
  - 저장 파일이 훨씬 작아집니다.
  - 곡 정보를 입력하면 한 글자마다가 아니라 입력 한 번이 실행취소 한 단계가 되고, 확대·표시 방식 변경은 실행취소나 "저장 안 됨" 상태에 영향을 주지 않습니다(C5).
- **다루는 항목:** B18, C5
- **크기:** 중간~큼(PR 6개)

#### 설계

**R8-1. 측정부터**

- `src/test/perf/`(신규): 배포용 빌드(`pnpm build` 후 `vite preview`)를 Playwright로 열고, 리마스터 플레이북 Phase 18과 같은 픽스처(1트랙 32마디, 8트랙 100마디, 20트랙 300마디)로 측정합니다.

| 항목 | 측정 방법 | 목표(100마디×8트랙) |
|---|---|---|
| 편집 반응 | 키 입력부터 다음 화면 그리기까지, 50회의 중앙값과 상위 5% | 상위 5% < 50ms |
| 커서 이동 | 같은 방식 | ≤ 16ms |
| 메모리 | 편집 20회 전후의 힙 사용량(가비지 수집 후) | 증가 ≤ 50MB |
| 재생 중 긴 작업 | PerformanceObserver의 longtask(50ms 초과) 횟수, 4초 재생 | 0~2회 |
| 파일 크기 | 저장한 파일의 바이트 수 | ≤ 1.5MB |

- 결과를 `docs/refactoring/perf-baseline.md`에 고치기 전·후 표로 남깁니다. CI에서는 PR마다 100마디×8트랙 편집 반응이 기준보다 20% 이상 나빠지면 경고를 남기고(공용 서버라 편차가 있어 실패로 하지 않음), 야간 실행으로 추세를 봅니다.

**R8-2. 화면 꾸밈을 레이아웃에서 떼기**

- 지금 `App.tsx`의 `baseScene`(192~200행)은 커서 전체(`cursor`), 편집 중인 마디, 활성 성부를 레이아웃 계산의 입력으로 받습니다. 그래서 커서만 움직여도 악보 전체를 다시 계산합니다.
- 레이아웃 입력에서 커서 관련 값을 모두 빼고, 편집 중 마디 강조와 활성 성부 색은 이미 있는 오버레이 단계(`withEditorOverlays`)에서 그립니다. 오버레이는 악보 SVG 위에 별도 층으로 그려 악보를 다시 그리지 않습니다. 이 한 가지로 커서 이동 목표(16ms 이하)를 맞출 수 있을 것으로 봅니다.

**R8-3. 마디 단위 레이아웃 재사용 — `src/engine/layout/layoutCache.ts`(신규)**

- R8-4에서 immer로 바꾸면, 바뀌지 않은 마디 객체는 같은 객체로 남습니다(구조 공유). 마디 i를 그리는 데 쓰인 입력(마스터 마디와 각 트랙의 마디)이 모두 같은 객체이고 폭·스타일·표기 설정이 같으면 이전 계산 결과를 다시 씁니다(`WeakMap` 사용).
- 줄 나누기는 처음으로 바뀐 마디가 속한 줄부터만 다시 합니다.
- 페이지별 React 컴포넌트를 `React.memo`로 감싸 바뀐 페이지만 다시 그립니다.
- 안전장치: 무작위 편집을 이어서 한 뒤 "재사용한 결과 = 처음부터 새로 계산한 결과"인지 비교하는 속성 테스트를 둡니다.

**R8-4. 실행취소를 변경분 방식으로 (C5 포함) — 데이터 형식 v6**

- `documentStore`를 immer의 `produceWithPatches`로 바꿉니다. 기록 항목은 `{ label, patches, inversePatches, revisionBefore, revisionAfter, cursorBefore, cursorAfter, time }`이고, 실행취소는 `applyPatches(score, inversePatches)`입니다. 지금 트랜잭션마다 만드는 악보 전체 사본 3개(`cloneScore`, 55~69행)를 없애고, 기록은 최대 500단계로 제한합니다.
- 지금의 `transact(label, recipe)`는 이미 "draft를 직접 고치는" 형태라 immer의 방식과 그대로 맞습니다. immer의 변경분 기능은 앱 시작 때 `enablePatches()`를 한 번 호출해야 켜집니다. 모델은 순수 객체와 배열만 써서(`types.ts`) immer의 Map·Set 설정은 필요 없습니다.
- 묶기 규칙(C5): 같은 입력란의 연속 입력은 입력란을 벗어나거나 Enter를 누를 때 한 단계로 기록합니다. 같은 위치에서 1초 안에 같은 명령이 반복되면(숫자 두 자리, 슬라이더) 한 단계로 합칩니다.
- 확대(`zoom`)와 표시 방식(`displayMode`)은 악보 데이터(`Score.documentSettings`)에서 화면 상태(`viewStore`)로 옮깁니다. 파일에는 봉투의 `view` 칸에 "마지막 화면 설정"으로 따로 저장하고, 실행취소와 저장 상태(dirty)에는 영향을 주지 않습니다. 이 이동이 데이터 형식 v6입니다.

**R8-5. 보이는 페이지만 그리기**

- 페이지(가로 스크롤 모드에서는 줄 묶음)를 IntersectionObserver로 확인해, 화면에 보이는 페이지와 앞뒤 한 페이지만 SVG로 그리고 나머지는 같은 크기의 빈 자리로 둡니다. 100마디×8트랙에서 SVG 요소 38,295개를 수천 개 수준으로 줄이는 것이 목표입니다.

**R8-6. 재생 준비와 예약을 화면 작업에서 떼기**

- 재생 준비 계산(`compilePlayback`)은 악보가 바뀔 때만 다시 하고(커서와 무관하게), 큰 악보에서는 Web Worker에서 계산합니다.
- 소리 예약 창을 0.2초에서 0.5초로 늘려 짧은 화면 작업에 밀리지 않게 하고, 예약 시계는 Worker 타이머로 옮겨 배경 탭에서도 느려지지 않게 합니다. 근본 대책은 R8-2~R8-5로 화면 작업 자체를 줄이는 것입니다.

**R8-7. 파일 크기**

- `writeScoreFile`에서 기본값과 같은 필드는 쓰지 않습니다. 읽을 때 R1의 "기본값 채우기"가 되살립니다. 들여쓰기는 R1에서 이미 없앴습니다. 목표는 100마디×8트랙에서 9.3MB → 1.5MB 이하입니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R8-a | 성능 측정 도구와 기준값 기록(R8-1) |
| R8-b | 커서·강조를 오버레이로(R8-2) |
| R8-c | immer 변경분 실행취소, 묶기 규칙, 화면 설정 분리(데이터 v6)(R8-4) |
| R8-d | 마디 단위 레이아웃 재사용 + 비교 속성 테스트(R8-3) |
| R8-e | 보이는 페이지만 그리기(R8-5) |
| R8-f | 재생 준비 Worker, 예약 창, 파일 크기(R8-6, R8-7) |

#### 재현 테스트

- `[B18]` 위 표의 목표(성능 측정 모음에서 확인)
- `[C5]` 곡 제목에 "Hello"를 입력하고 입력란을 벗어나면 실행취소 1단계 / 확대를 바꿔도 실행취소 기록과 dirty가 그대로

#### 완료 기준

- [ ] 위 목표를 측정으로 확인했고 `perf-baseline.md`에 전후 표가 있다.
- [ ] 레이아웃 재사용 비교 속성 테스트가 통과한다.
- [ ] 이전 단계의 모든 테스트가 그대로 통과한다.

#### 직접 확인

1. 개발자가 준비한 큰 시험 악보(100마디×8트랙)를 열고 숫자를 연달아 입력합니다. 바로바로 나타나는지 봅니다.
2. 화살표로 커서를 빠르게 움직여도 따라오는지 봅니다.
3. 같은 악보를 재생해 소리가 끊기지 않는지 듣습니다.
4. 곡 제목을 입력하고 다른 곳을 누른 뒤 `Ctrl+Z` → 제목 전체가 한 번에 되돌아가는지 봅니다.
5. 확대·축소만 하고 탭을 닫으려 할 때 "저장 안 됨" 경고가 뜨지 않는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| 레이아웃 재사용이 오래된 결과를 보여 줌 | 재사용 결과와 새 계산 결과를 비교하는 속성 테스트 |
| immer 전환으로 기존 편집 함수가 깨짐 | 전환 PR에서 기존 단위·e2e 테스트 전체 통과를 조건으로 |
| 공용 CI 서버의 측정 편차 | CI에서는 경고만, 판단은 같은 PC에서 잰 전후 비교로 |

#### AI 프롬프트 (R8)

```text
[R8 성능]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 B18, C5. 설계서 R8-1 ~ R8-7. PR 6개(R8-a ~ R8-f). 측정 → 변경 → 재측정 순서를 지킨다.
먼저 읽을 것: src/app/App.tsx(scoreForLayout, baseScene, scene), src/engine/editing/overlays.ts,
  src/store/{documentStore,viewStore}.ts, src/engine/layout/*, src/engine/render/SvgRenderer.tsx,
  src/app/controllers/usePlaybackController.ts, src/io/fileFormat.ts, 리마스터 플레이북 Phase 18
R8-a: src/test/perf/(preview 빌드, 픽스처 3종, 표의 항목), docs/refactoring/perf-baseline.md에 기준값.
R8-b: 레이아웃 입력에서 cursor·editingBar·activeVoiceIndex 제거, 오버레이 별도 층.
R8-c: produceWithPatches 기반 기록(500단계), 묶기 규칙, zoom·displayMode를 viewStore로(스키마 v6 + 변환).
R8-d: layoutCache.ts(WeakMap, 바뀐 줄부터 다시 나누기, 페이지 React.memo) + 비교 속성 테스트.
R8-e: IntersectionObserver로 보이는 페이지 ±1만 그리기.
R8-f: compilePlayback Worker, 예약 창 0.5초, Worker 타이머, 기본값 생략 저장.
각 PR에 전후 측정표를 붙인다. 금지: 측정 없이 "빨라졌다"고 보고하기.
```

### R9. 마무리와 UI 리마스터 재개

- **목표:** 화면의 모든 요소가 동작하거나 숨겨진 상태로 만들고, 멈춰 둔 UI 리마스터를 다시 시작합니다.
- **끝나면 달라지는 점:**
  - 메뉴의 항목을 누르면 동작합니다. 지금 쓸 수 없는 항목은 흐리게 표시됩니다.
  - 명령 검색창에는 실제로 실행되는 명령만 나옵니다.
  - 스타일 설정의 옵션이 실제로 악보를 바꾸고, 용지 선택과 스타일 저장이 동작합니다.
  - 아직 없는 기능의 빈 자리(Design, Lyrics, Chords 등)가 화면에서 사라집니다.
  - 키보드만으로도 버튼을 오갈 수 있고, 화면 읽기 프로그램이 버튼 이름을 읽습니다.
  - 처음 열면 개발용 데모 대신 시작 화면이 나옵니다.
  - 이후 리마스터 플레이북 Phase 4~19를 진행합니다.
- **다루는 항목:** C1, C2, C3, C8, C9, C12, D6(나머지)
- **크기:** 큼(이 설계서의 R9 작업 PR 6개 + 리마스터 Phase 4~19)

#### 설계

**R9-1. 메뉴 (C1)** — 리마스터 Phase 6과 같은 작업입니다. 메뉴를 데이터(`menus.ts`: 메뉴 → 항목 → 명령 ID)로 정의하고, 항목의 사용 가능 여부는 명령의 `contextPredicate`, 단축키 표시는 키맵에서 가져옵니다. 문서 탭의 "+"는 여러 문서 기능(C8)이 생길 때까지 숨깁니다.

**R9-2. 명령 검색창 (C2)** — 등록되어 있고 지금 실행할 수 있는 명령만 보여 줍니다. 고급 명령 69개 중 거부되던 53개는 구현하거나 목록에서 뺍니다. "multirest"는 지금 마디 반복 기호(simile)를 켜므로, 여러 마디 쉼표 표시로 고치거나 목록에서 뺍니다. 검색창의 모든 항목을 차례로 실행해 보는 e2e 테스트에서 예외가 0건이어야 합니다("여기서는 쓸 수 없습니다" 같은 정해진 안내는 허용).

**R9-3. 스타일 설정 (C3)** — 옵션 109개를 (가) 이미 동작, (나) 이번에 연결(용지·여백·글자 크기·간격처럼 R3·R4에서 이미 쓰는 값), (다) 숨김으로 나눈 표를 PR에 붙입니다. "Paper"는 페이지 크기와 인쇄 CSS에 연결합니다. "Save style"은 지금 localStorage에 쓰기만 하고 읽지 않으므로(`StylesheetPanel.tsx` 69행), 문서의 스타일과 환경설정의 "기본 스타일"로 저장하고 새 문서를 만들 때 읽게 합니다.

**R9-4. 아직 없는 기능 정리 (C8)** — 기획서에 있지만 아직 없는 기능(가사, 악보 위 코드 다이어그램, 디자인 모드, 환경설정, 오디오 트랙, 오디오 내보내기, MIDI 입력, 파일 보호, 여러 문서 탭)은 화면에서 숨기고, `docs/refactoring/feature-backlog.md`(신규)에 우선순위와 함께 정리합니다. 마우스로 끌어 선택하기는 R7에서 끝났고, 홈 화면과 여러 문서 탭은 리마스터 Phase 14·8에서 합니다.

**R9-5. 접근성 (C9)** — 아이콘 버튼마다 이름(`aria-label`)을 달고, 장식 아이콘은 `aria-hidden`, 키보드 포커스 표시(`:focus-visible`)를 토큰으로 정합니다. 대화창은 포커스를 안에 가두고 Esc로 닫으면 원래 자리로 돌아갑니다(리마스터 Phase 4·17의 원칙과 같음). `@axe-core/playwright`로 주요 화면을 검사해 심각·중대 위반을 0건으로 만듭니다.

**R9-6. 시작 화면과 화면 문구 (C12)** — 처음 열 때 개발용 데모 대신 시작 화면을 보여 줍니다: [새 악보](악기·튜닝·템포·박자 고르기) [파일 열기] [최근 파일](자동 저장 목록) [데모 보기]. 화면 문구는 `src/ui/i18n/messages.en.ts`(한국어를 정하면 `messages.ko.ts` 추가)에 모으고 `t("키")`로 표시합니다. 결정 7에 따라 언어를 정하고 `index.html`의 `lang`도 맞춥니다. 시작 화면의 최종 모양은 리마스터 Phase 14(Home 런처)에서 다듬습니다.

**R9-7. 코드 구조 정리 (D6 나머지)** — 마디 길이 검사가 두 벌(`engine/validate/barDuration.ts`의 `validateBarDurations`, `engine/tools/barReport.ts`의 `checkBarDurations`)이므로 하나로 합치고 불변식(R1)의 `bar-length`도 그 함수를 씁니다. `EditorShell.tsx`(1,159줄)를 플레이북 §4 구조로 나누는 일은 리마스터 Phase 5 등에서 합니다.

**R9-8. 리마스터 재개** — 플레이북 §2.3을 "R 단계에서 고친 엔진은 이제 기준선이며, 리마스터 Phase에서는 음악 로직을 바꾸지 않는다"로 고치고 Phase 4부터 진행합니다. R 단계에서 이미 한 부분(Phase 7의 넘침 처리 = R3, Phase 17의 포커스 일부 = R2, Phase 18의 성능 = R8, Phase 6의 메뉴 = R9-1)은 해당 Phase 프롬프트에 "검증만"이라고 표시합니다. 대응표는 부록 C에 있습니다.

#### 작업 순서

| PR | 내용 |
|---|---|
| R9-a | 메뉴 데이터화(R9-1) |
| R9-b | 명령 검색창 정리와 전수 실행 테스트(R9-2) |
| R9-c | 스타일 옵션 분류·연결·저장(R9-3) |
| R9-d | 없는 기능 숨기기와 기능 목록 문서(R9-4) |
| R9-e | 접근성(R9-5) |
| R9-f | 시작 화면, 문구 모으기, 검증기 통합(R9-6, R9-7) |
| 이후 | 리마스터 Phase 4~19(R9-8) |

#### 재현 테스트

- `[C1]` 모든 메뉴 항목이 실행되거나 비활성 상태(눌러도 아무 일 없는 항목 0개)
- `[C2]` 검색창 전 항목 실행에서 예외 0건
- `[C3]` "(나) 연결" 옵션마다 바꾸면 해당 치수가 바뀜
- `[C8]` 숨긴 기능의 버튼이 화면에 없음
- `[C9]` axe 심각·중대 0건 / 이름 없는 버튼 0개
- `[C12]` 처음 방문하면 시작 화면, 데모는 자동으로 열리지 않음

#### 완료 기준

- [ ] 위 테스트가 통과한다.
- [ ] 보고서의 50개 항목이 추적표(8장)에서 모두 "완료" 또는 "기능 목록으로 이관"이다.
- [ ] 크롬·엣지·파이어폭스·사파리(가능한 것)에서 직접 확인 목록을 한 번 돌렸다.

#### 직접 확인

1. 위쪽 메뉴(File, Edit …)를 하나씩 열어 항목을 눌러 봅니다. 아무 일도 없는 항목이 없어야 합니다.
2. `Ctrl+E`로 명령 검색창을 열고 몇 가지 명령을 실행해 봅니다. 오류 없이 실행되거나 "여기서는 쓸 수 없습니다"가 나와야 합니다.
3. 스타일 설정에서 용지를 바꾸면 페이지 크기가 바뀌는지 봅니다.
4. Tab 키로 도구줄을 지나가며 포커스 테두리가 보이는지 봅니다.
5. 브라우저의 사이트 데이터를 지우거나 다른 브라우저로 처음 열어 시작 화면이 나오는지 봅니다.

#### 위험

| 위험 | 대응 |
|---|---|
| 스타일 옵션을 연결하다 레이아웃이 달라짐 | R3의 레이아웃 검사 테스트와 화면 비교로 확인 |
| 기능을 숨겨 "없어졌다"고 느낄 수 있음 | 숨긴 기능은 `feature-backlog.md`와 README의 "준비 중" 목록에 적음 |
| 리마스터 Phase 4~19의 범위가 큼 | 플레이북의 Phase 단위와 품질 게이트(§5)를 그대로 따르고, 한 Phase씩 진행 |

#### AI 프롬프트 (R9)

```text
[R9 마무리]  ※ 공통 맥락 프롬프트를 앞에 붙인다
범위: 보고서 C1, C2, C3, C8, C9, C12, D6(나머지). 설계서 R9-1 ~ R9-7. PR 6개(R9-a ~ R9-f).
먼저 읽을 것: src/ui/shell/{EditorShell,CommandPalette,StylesheetPanel}.tsx, src/commands/*,
  src/model/stylesheet.ts, src/engine/validate/barDuration.ts, src/engine/tools/barReport.ts,
  리마스터 플레이북 Phase 4·6·14·17, 설계서 부록 C
원칙: 동작하지 않는 요소는 숨기거나 비활성으로. 눌러도 아무 일도 없는 버튼을 남기지 않는다.
R9-a: menus.ts 데이터화, contextPredicate로 활성 여부, 키맵에서 단축키 표시, 탭 "+" 숨김.
R9-b: 명령 검색창 목록 정리(등록·실행 가능한 것만), multirest 수정 또는 제외, 전수 실행 e2e.
R9-c: 스타일 옵션 109개 분류표, (나) 연결, Paper·Save style 동작.
R9-d: 미구현 기능 숨김, docs/refactoring/feature-backlog.md.
R9-e: aria-label·aria-hidden·focus-visible·대화창 포커스, @axe-core/playwright 검사.
R9-f: 시작 화면, src/ui/i18n/ 문구 모으기, 마디 길이 검사 하나로 합치기.
금지: 엔진 로직 변경. 리마스터 Phase 진행(별도 지시).
```

---

## 6. 데이터 모델과 저장 파일 형식의 변경

저장 파일의 형식은 단계마다 조금씩 바뀝니다. 바뀔 때마다 버전(`schemaVersion`)을 1씩 올리고, 예전 버전 파일은 열 때 차례로 변환합니다. 그래서 어느 단계에서 저장한 파일이든 최신 앱에서 열립니다.

| 버전 | 단계 | 바뀌는 것 | 예전 파일 변환 규칙 |
|---|---|---|---|
| v1 | 지금 | 봉투 `guitar-pro-clone/native-score`, `version: 1`, 들여쓰기 있는 JSON | — |
| v2 | R1 | 새 봉투(`format`, `schemaVersion`, `app`, `documentId`, `savedAt`, `score`), 들여쓰기 없음 | `documentId` 발급, 트랙 ID 중복 해소, 모자란 마디는 빈 마디로 |
| v3 | R2 | `Note.tiedFromPrevious` 추가, `tieOrigin`·`tieDestination` 삭제 | `tieOrigin`이 있으면 true. 원래 음이 없는 붙임줄은 경고 |
| v4 | R4 | `Track.kind`, `Track.clef` 추가. 현악기 음의 `midiPitch` 삭제 | 아이콘·`interpretation.stringed`로 종류 추정. 기타 `treble8vb`, 베이스 `bass8vb` |
| v5 | R5 | `Track.mix`, `Score.masterMix` 추가. 볼륨 값 0~1. `tripletFeel` 값을 `"8th" \| "16th" \| null`로 | 기본 믹서 값으로 채움. 볼륨 자동화 값이 1.2보다 크면 ÷100. `"8th swing"` → `"8th"` |
| v6 | R8 | `documentSettings.zoom`·`displayMode`를 봉투의 `view`로 이동. 기본값 필드 생략 | 값 이동 |

```ts
// src/io/fileFormat.ts — 변환 체인
type Migration = (doc: unknown, warnings: string[]) => unknown;

const migrations: Record<number, Migration> = {
  1: v1ToV2, // R1
  2: v2ToV3, // R2
  3: v3ToV4, // R4
  4: v4ToV5, // R5
  5: v5ToV6, // R8
};

export function migrateToCurrent(doc: unknown, fromVersion: number, warnings: string[]): unknown {
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    throw new UserFacingError("이 파일은 더 새로운 버전의 앱에서 저장되었습니다. 앱을 새로 고친 뒤 다시 열어 주세요.");
  }
  let version = fromVersion;
  let current = doc;
  while (version < CURRENT_SCHEMA_VERSION) {
    current = migrations[version](current, warnings);
    version += 1;
  }
  return current;
}
```

- 변환 함수는 순수 함수이고, 버전마다 픽스처 파일(`src/test/fixtures/files/v1-demo.json` 등)로 테스트합니다. R0에서 지금 앱으로 저장한 데모 파일을 v1 픽스처로 보관해 둡니다.
- 변환 중에 생긴 경고는 파일을 연 뒤 한 번에 보여 줍니다("붙임줄 2개를 이을 음이 없어 보통 음으로 바꿨습니다" 등).

---

## 7. 테스트 전략

| 종류 | 도구 | 무엇을 확인하나 | 언제 돌리나 |
|---|---|---|---|
| 단위 | Vitest(Node) | 모델·엔진·파일 형식의 순수 함수: 음 이름, 오선 위치, 재생 순서, 템포, 붙임줄, 코드, 스케일, 조옮김, 줄 배정, MIDI 바이트, 불변식, 변환 | 모든 PR |
| 단위(DOM) | Vitest(jsdom) | MusicXML 해석 | 모든 PR |
| 속성 기반 | fast-check(MIT) + Vitest | 무작위 편집 뒤에도 불변식 유지, 템포 왕복, 파일 왕복, 레이아웃 재사용 = 새 계산 | 모든 PR(횟수 적게), 야간(많이) |
| 동작(e2e) | Playwright(크롬) | 키 입력, 대화창, 자동 저장, 재생 상태, 포커스·단축키 | 모든 PR |
| 화면 비교 | Playwright 스크린샷 | 셸(화면 크기 4종), 악보 픽스처 첫 페이지 | 화면을 바꾸는 PR. 기준 갱신은 승인 후에만 |
| 소리 | Playwright + OfflineAudioContext | 최대값·RMS·한계 초과 시간, 이벤트 시각, 믹서 즉시 반영 | 소리를 바꾸는 PR |
| 파일 적합성 | Vitest + `midi-file`·`@tonejs/midi`, Playwright `page.pdf()` | MIDI 판독, MusicXML 왕복, PDF 페이지·글자 | 모든 PR |
| 성능 | Playwright(배포 빌드) | R8-1의 표 | 엔진·화면 PR(경고만), 야간 |
| 접근성 | `@axe-core/playwright`(MPL-2.0) | 심각·중대 위반 | R9부터 모든 PR |

- **픽스처:** R0-5의 목록에 단계마다 필요한 것을 더합니다(R5: 순서 표 픽스처, R6: MusicXML 6개·MIDI, R8: 20트랙 300마디). 픽스처는 코드(빌더)로 만들고, 파일 픽스처는 `src/test/fixtures/files/`에 둡니다.
- **알려진 결함 테스트:** 4.2의 방식. 이름은 `[항목 ID]`로 시작합니다.
- **CI 작업:** `check`(모든 PR), `visual`(Docker 안, 수동 또는 화면 PR), `perf`(야간·수동), `audit`(주 1회).
- **테스트를 지우거나 건너뛰지 않습니다.** 동작이 바뀌어 테스트가 맞지 않게 되면, 테스트를 고치는 이유를 PR 설명에 적습니다.

---

## 8. 추적표 — 보고서 50개 항목

"완료" 칸은 단계가 끝날 때 성태 님이 채웁니다. 테스트 파일 경로는 `src/` 아래 기준이며, Playwright 테스트는 `test/e2e/regressions/`에 둡니다.

| ID | 요약 | 단계 | 재현 테스트 | 직접 확인 | 완료 |
|---|---|---|---|---|---|
| A1 | → 키가 다음 박으로 못 감 | R2 | `test/e2e/regressions/input.spec.ts` | 5·7·8 입력 | ☐ |
| A2 | 빠른 입력 시 숫자가 합쳐짐 | R2 | `test/e2e/regressions/input.spec.ts` | 빠르게 5→7 | ☐ |
| A3 | 도구줄이 화면 밖 | R3 | `test/e2e/regressions/toolbar.spec.ts` | 창 크기 바꾸기 | ☐ |
| A4 | 오선보 음높이 오류 | R4 | `engine/notation/*.test.ts`, 화면 비교 | 개방현 E 위치 | ☐ |
| A5 | 쉼표·늘임표·임시표 안 보임 | R3 | `test/e2e/regressions/fonts.spec.ts` | 쉼표 보임 | ☐ |
| A6 | 줄 겹침·페이지 넘침 | R3 | `engine/layout/layout.invariants.test.ts` | 8트랙 보임 | ☐ |
| A7 | 재생 중 이동 시 상태 어긋남 | R5 | `test/e2e/regressions/playback.spec.ts` | Ctrl+→ 뒤 Space | ☐ |
| A8 | 기본 소리 클리핑, 볼륨 자동화 오류 | R5 | `test/audio/levels.spec.ts` | 이어폰으로 듣기 | ☐ |
| A9 | 흰 화면 2건 | R1 | `test/e2e/regressions/crash.spec.ts` | 6줄→5줄 | ☐ |
| A10 | 작업 손실(경고·자동 저장 없음) | R1 | `test/e2e/regressions/dirty-autosave.spec.ts` | 닫기·복구 | ☐ |
| A11 | 트랙 ID 중복 | R1 | `test/e2e/regressions/track-ids.spec.ts` | 열고 트랙 추가 | ☐ |
| B1 | 붙임줄 무음·방향·깨짐 | R2 | `model/ties.test.ts`, `engine/audio/compile.regressions.test.ts` | L 후 재생 | ☐ |
| B2 | 재생 순서·표현 누락 | R5 | `engine/unroll/unrollScore.regressions.test.ts` | D.S. al Coda 듣기 | ☐ |
| B3 | 템포 램프 위치 오차 | R5 | `engine/audio/tempoMap.regressions.test.ts` | 램프 구간 재생 | ☐ |
| B4 | 드럼 표기·소리, 단일 음색 | R4·R5 | `engine/layout/staffMetrics.test.ts`, `engine/audio/drumSynth.test.ts` | 드럼 보표·소리 | ☐ |
| B5 | 믹서·반복·따라가기·메트로놈 | R5 | `test/e2e/regressions/mixer.spec.ts`, `test/audio/mixer.spec.ts` | 재생 중 음소거 | ☐ |
| B6 | Am을 장조로 읽음 | R7 | `model/chords.regressions.test.ts` | Am 구성음 | ☐ |
| B7 | 스케일 중복 | R7 | `model/scales.regressions.test.ts` | 목록 확인 | ☐ |
| B8 | 개방현 조옮김 안 됨 | R7 | `engine/tools/transpose.regressions.test.ts` | Em −2 | ☐ |
| B9 | 튜닝 재배치·정리 도구 오류 | R7 | `model/instruments.regressions.test.ts`, `app/controllers/cleanup.test.ts` | 같은 튜닝 재배치 | ☐ |
| B10 | 새 마디가 항상 4/4 C | R2 | `engine/editing/operations.regressions.test.ts` | 3/4 곡에 마디 추가 | ☐ |
| B11 | 오선 입력이 항상 개방현 | R4 | `test/e2e/regressions/standard-input.spec.ts` | 오선 모드 입력 | ☐ |
| B12 | 단축키·포커스 | R2 | `commands/keymap.regressions.test.ts`, `test/e2e/regressions/shortcuts.spec.ts` | 한글 상태 X | ☐ |
| B13 | MusicXML 왕복·호환 | R6 | `io/musicXml/import.test.ts`, `io/musicXml/roundtrip.test.ts` | 내보내고 다시 열기 | ☐ |
| B14 | MIDI 판독 거부·프로그램 번호 | R6 | `io/midi/export.test.ts`, `io/midi/import.test.ts` | 다른 프로그램에서 열기 | ☐ |
| B15 | PDF·PNG·ASCII 내보내기 | R6 | `test/e2e/regressions/export.spec.ts` | PDF로 저장 | ☐ |
| B16 | 확장자 `.gp`, GP 파일 오류 원문 | R1 | `io/sniffFileType.test.ts` | GP 파일 끌어 놓기 | ☐ |
| B17 | 복사·붙여넣기 한 마디만 | R7 | `test/e2e/regressions/clipboard.spec.ts` | 3마디 복사 | ☐ |
| B18 | 큰 악보 성능·메모리 | R8 | `test/perf/*.spec.ts` | 큰 악보 입력 | ☐ |
| B19 | 튜너 옥타브 오인 | R7 | `model/tuner.regressions.test.ts` | 기타 줄 튕기기 | ☐ |
| C1 | 장식 메뉴 | R9 | `test/e2e/menus.spec.ts` | 메뉴 눌러 보기 | ☐ |
| C2 | 명령 검색창 거부 | R9 | `test/e2e/palette.spec.ts` | Ctrl+E | ☐ |
| C3 | 스타일 옵션 무효 | R9 | `model/stylesheet.wiring.test.ts` | 용지 바꾸기 | ☐ |
| C4 | LCD 템포 고정 | R5 | `test/e2e/lcd.spec.ts` | LCD 숫자 | ☐ |
| C5 | 실행취소 단위 | R8 | `store/history.test.ts` | 제목 입력 후 Ctrl+Z | ☐ |
| C6 | 효과가 글자, 벤딩 항상 full | R4 | 화면 비교, `engine/notation/effects.test.ts` | 벤딩 1/2 | ☐ |
| C7 | 표기 설정 무시, 피아노 범위 | R4 | `engine/layout/staffMetrics.test.ts` | TAB만 보기 | ☐ |
| C8 | 계획된 기능 없음 | R9 | `test/e2e/hidden-features.spec.ts` | 빈 버튼 없음 | ☐ |
| C9 | 접근성 | R9 | `test/e2e/a11y.spec.ts` | Tab 이동 | ☐ |
| C10 | 인쇄 스타일 없음 | R6 | `test/e2e/print.spec.ts` | 인쇄 미리보기 | ☐ |
| C11 | 파일 이름 날짜 하루 전 | R6 | `io/exportNames.test.ts` | (생략 가능) | ☐ |
| C12 | 영어 전용, 데모 자동 열림 | R9 | `test/e2e/start-screen.spec.ts` | 처음 열기 | ☐ |
| C13 | 자동화 지점 안 움직임 | R2 | `engine/editing/automationShift.test.ts` | — | ☐ |
| C14 | 튜닝을 숫자로 입력 | R7 | `test/e2e/tuning-input.spec.ts` | 튜닝 창 | ☐ |
| D1 | 매뉴얼 PDF·이름·확장자 | R0·R1 | 저장소 확인 | 저장소 첫 화면 | ☐ |
| D2 | 브랜치 갈라짐, 잠금 파일 | R0 | CI `check`의 frozen 설치 | Actions 초록 | ☐ |
| D3 | README·LICENSE 없음 | R0 | — | README 보임 | ☐ |
| D4 | 보안 경고 | R0 | CI `audit` | — | ☐ |
| D5 | 테스트·CI 부족 | R0 | CI 자체 | Actions 초록 | ☐ |
| D6 | 코드 구조(단축키 3곳, 검증기 2벌, 큰 파일) | R2·R9 | `commands/keymap.regressions.test.ts` | — | ☐ |

---

## 9. 순서와 규모

```text
R0 → R1 → R2 ─┬─→ R3 → R4 ─┬─→ R6 → R8 → R9 → (UI 리마스터 Phase 4~19)
              │            │
              └─→ R5 ──────┘
                  R7: R4가 끝난 뒤 아무 때나(줄 배정·트랙 종류 규칙을 씀)
```

- R3·R4(화면)와 R5(소리)는 서로 독립이라, 소리 문제가 더 급하면 R5를 먼저 해도 됩니다.
- R6은 R4(트랙 종류·음높이 규칙)와 R5(펼친 재생 순서)를 씁니다.
- R8은 레이아웃을 다시 만든 R3·R4 뒤에 하는 것이 같은 일을 두 번 하지 않는 길입니다.

| 단계 | PR 수 | 상대 크기 | 앞 단계 |
|---|---|---|---|
| R0 | 3 + main 교체 | 작음 | — |
| R1 | 4 | 중간 | R0 |
| R2 | 5 | 중간 | R1 |
| R3 | 4 | 중간 | R2 |
| R4 | 7 | 큼 | R3 |
| R5 | 6 (+ R5-B 3~4) | 큼 | R2 |
| R6 | 7 | 큼 | R4, R5 |
| R7 | 5 | 중간 | R4 |
| R8 | 6 | 중간~큼 | R3, R4 |
| R9 | 6 (+ 리마스터) | 큼 | R6, R7, R8 |
| 합계 | 약 53 (+ R5-B) | | |

기간은 이번 설계에서 어림하지 않았습니다. R0~R1의 PR 7개를 진행한 속도를 보고 나머지를 다시 어림하는 것이 가장 정확합니다.

---

## 10. 전체 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| AI가 범위를 넘어 여러 곳을 한꺼번에 고침 | 새 결함, 검토 불가 | 프롬프트에 범위·금지를 적고, PR 크기 기준(4.1)을 넘으면 나눔. 8장 추적표로 범위 확인 |
| 테스트를 지우거나 건너뛰어 통과시킴 | 결함이 숨음 | 공통 프롬프트에서 금지. PR 설명에 테스트 수 변화를 적음 |
| 저장 파일 형식 변경으로 예전 파일이 안 열림 | 작업물 손실 | 버전별 변환과 픽스처 테스트(6장). 열기 전에 원본을 바꾸지 않음 |
| main 강제 교체 실수 | 기록 손실 | 백업 브랜치·태그, `--force-with-lease`, 성태 님 승인 후 실행 |
| 오선보·레이아웃 재작성이 길어짐 | 일정 지연 | 옛 엔진을 남겨 둔 채 설정으로 전환, PR을 작게 |
| 화면 비교 기준 이미지를 기계적으로 갱신 | 시각 결함이 숨음 | 기준 갱신은 R3·R4에서만, 차이 이미지를 보고 승인 |
| 성태 님 PC(Windows)의 빌드 환경 문제 | 로컬 확인 불가 | Node 24 고정, CI와 미리보기 배포로 확인 |
| 실제 기기 차이(한글 입력기, Mac, Safari, 마이크) | 일부 결함이 남음 | 각 단계의 [흉내] 테스트 + 단계 끝 실제 기기 확인 목록 |
| 상표·저작권 | 법적 위험 | R0·R1의 이름·확장자·PDF 정리. 공개 배포 전 전문가 확인 |

---

## 11. 부록

### 부록 A. 용어 풀이

| 용어 | 뜻 |
|---|---|
| 불변식 | 악보 데이터가 언제나 지켜야 하는 조건(예: 모든 트랙의 마디 수가 같다) |
| 트랜잭션 | 한 번의 편집. 성공하면 통째로 저장되고, 실패하면 아무것도 바뀌지 않음 |
| 재현 테스트 | 보고된 결함이 실제로 일어나는지 자동으로 확인하는 테스트 |
| 알려진 결함 테스트 | 지금은 실패가 정상이라고 표시해 둔 재현 테스트(4.2) |
| 픽스처 | 테스트에 쓰려고 미리 만들어 둔 시험용 악보 |
| CI | 코드를 올릴 때마다 서버에서 자동으로 검사를 돌리는 장치(GitHub Actions) |
| 잠금 파일 | 설치할 부품의 정확한 버전을 적어 둔 목록(`pnpm-lock.yaml`) |
| 스키마 버전·변환 | 저장 파일 형식의 버전 번호와, 예전 형식을 새 형식으로 바꾸는 함수 |
| 레이아웃 | 악보의 무엇을 화면 어디에 그릴지 계산하는 단계 |
| 오버레이 | 악보 위에 겹쳐 그리는 커서·선택·재생 위치 층 |
| 시스템 | 악보의 한 줄(모든 트랙의 같은 마디 묶음) |
| 보표 띠 | 한 트랙 안의 오선·TAB·리듬 표시 줄 하나 |
| SMuFL | 악보 기호 글꼴의 국제 표준 배치 규칙. Bravura가 기준 글꼴 |
| dBFS | 디지털 소리의 크기 단위. 0이 한계치이고 넘으면 소리가 찌그러짐 |
| RMS | 평균적인 소리 크기 |
| 틱 | 앱 내부의 시간 단위. 4분음표 하나가 480틱 |
| 펼치기(unroll) | 도돌이표·점프를 따라 실제 연주 순서대로 마디를 늘어놓는 계산 |
| 템포 지도 | 각 위치의 템포와 "틱 ↔ 초" 변환을 담은 표 |
| 버스·리미터 | 여러 소리를 모아 한 번에 조절하는 통로, 그리고 한계치를 넘지 않게 눌러 주는 장치 |
| 왕복 테스트 | 내보낸 파일을 다시 가져와 원래와 같은지 비교하는 테스트 |
| 속성 기반 테스트 | 무작위 입력을 많이 만들어 "항상 성립해야 하는 성질"을 확인하는 테스트 |
| IndexedDB | 브라우저 안의 저장소. localStorage보다 큰 데이터를 담을 수 있음 |
| 입력기(IME) | 한글처럼 조합해서 입력하는 문자의 입력 프로그램 |
| PR | 고친 코드를 기준 브랜치에 합치자고 올리는 요청. 검토와 자동 검사를 거침 |
| 미리보기 배포 | PR마다 만들어지는 임시 웹 주소. 합치기 전에 결과를 직접 볼 수 있음 |

### 부록 B. 외부 라이브러리와 자원

"확인" 칸은 이 설계서를 쓰며 공개 자료로 확인한 것입니다. "추가 전 확인"인 것은 해당 PR에서 라이선스를 다시 확인합니다.

| 이름 | 용도 | 라이선스 | 단계 | 확인 |
|---|---|---|---|---|
| Node.js 24 LTS | 개발·빌드 환경 | MIT | R0 | 24는 2028-04-30까지 지원, 25는 2026-06-01 지원 종료 확인 |
| Vite ^6.4.4 | 빌드 | MIT | R0 | 6.4.3의 경고가 6.4.4에서 해결됨(audit) |
| Vitest ^4.1.12 | 단위 테스트 | MIT | R0 | 중대 경고 해결 버전(audit), Vite 6 지원 |
| Bravura | 악보 기호 글꼴 | SIL OFL 1.1 | R3 | 앱에 넣어 배포 가능, 글꼴만 따로 팔 수 없음, 파생 글꼴에 "Bravura" 이름 금지 |
| zod | 파일 구조 검사 | MIT | R1 | 추가 전 확인 |
| idb-keyval(선택) | IndexedDB 도우미 | Apache-2.0 | R1 | 추가 전 확인 |
| immer | 변경분 실행취소 | MIT | R8 | 이미 설치됨 |
| jsdom | 테스트용 DOM | MIT | R6 | 추가 전 확인 |
| fflate | ZIP(.mxl, PNG 묶음) | MIT | R6 | 추가 전 확인 |
| midi-file | MIDI 읽기·쓰기 | MIT | R6 | 추가 전 확인 |
| @tonejs/midi | MIDI 판독 검사(테스트) | MIT | R6 | 추가 전 확인 |
| opentype.js | SVG 내보내기 기호 윤곽선 | MIT | R6 | 추가 전 확인 |
| pitchy | 튜너 음높이 검출(McLeod 방식) | MIT | R7 | 4.1.0, MIT 확인 |
| fast-check | 속성 기반 테스트 | MIT | R1~ | 추가 전 확인 |
| @axe-core/playwright | 접근성 검사 | MPL-2.0 | R9 | 추가 전 확인 |
| smplr(선택) | 샘플 재생 | MIT | R5-B | 추가 전 확인 |
| FluidR3 GM 사운드폰트(선택) | 악기 소리 | MIT(제작자 Frank Wen) | R5-B | 원본 MIT 확인. gleitz의 미리 변환본은 CC BY 3.0(출처 표기 필요), MusyngKite는 CC BY-SA 3.0이라 제외 |
| jsPDF, svg2pdf.js(나중) | 버튼 한 번에 PDF 저장 | MIT | 나중 과제 | 추가 전 확인 |

### 부록 C. UI 리마스터 플레이북과의 대응

| 플레이북 Phase | 내용 | 이 설계와의 관계 |
|---|---|---|
| 0~3 | 기준선 감사, Playwright 하네스, 컨트롤러 분리, CSS 토큰 | 완료. 이 설계의 기준 코드 |
| 4 | UI 기본 부품·아이콘 | R9 이후. R3의 도구줄 버튼은 Phase 4의 `ToolbarButton`으로 교체 |
| 5 | 셸 배치·도킹·스플리터 | R9 이후 |
| 6 | 동작하는 메뉴 | R9-1에서 수행 → Phase 6은 검증과 모양 |
| 7 | 도구줄·재생 버튼·LCD | 넘침 처리는 R3-1, LCD 템포는 R5-8 → Phase 7은 아이콘과 모양 |
| 8 | 여러 문서 탭 | R9 이후. 자동 저장의 `documentId`(R1)가 준비됨 |
| 9 | 왼쪽 팔레트 | R9 이후 |
| 10 | 악보 작업 공간·스크롤·줌 | 화면 따라가기 R5-7, 보이는 페이지만 그리기 R8-5 → Phase 10은 줌·스크롤 사용감 |
| 11 | SONG/TRACK 인스펙터 | R9 이후 |
| 12 | 하단 Global View·믹서 | 믹서 데이터·즉시 반영 R5-3 → Phase 12는 화면 |
| 13 | 오디오 트랙 | 기능 목록(R9-4)에서 우선순위 결정 |
| 14 | Home 런처 | 기본 시작 화면 R9-6 → Phase 14에서 완성 |
| 15 | 명령 검색창·오버레이 통합 | 명령 ID 타입 R2-3, 목록 정리 R9-2 |
| 16 | 도구·트랙·스타일·파일 패널 창 | 도구 정확도 R7, 스타일 연결 R9-3 → Phase 16은 창 처리 |
| 17 | 키보드·포커스·접근성 | 포커스 기본 R2-3, 접근성 R9-5 → Phase 17은 나머지 |
| 18 | 반응형·고해상도·성능 | 넘침 R3-1, 성능 R8 → Phase 18은 검증 |
| 19 | 최종 시각 감사 | 그대로 진행 |

### 부록 D. 파일별로 바뀌는 단계

같은 파일을 여러 단계에서 고치므로, 순서를 지키면 충돌을 줄일 수 있습니다.

| 파일 | 바뀌는 단계 |
|---|---|
| `src/model/types.ts` | R2(붙임줄), R4(트랙 종류·음자리표), R5(믹서), R8(화면 설정 이동) |
| `src/model/derive.ts` | R1(`tryNoteMidiPitch`), R4(음높이 규칙, 적는 음) |
| `src/model/factory.ts` | R1(ID) |
| `src/model/instruments.ts` | R1(줄 수 감소), R4(음자리표), R7(줄 배정) |
| `src/store/documentStore.ts` | R1(관문, revision), R2(커서 기록), R8(변경분 기록) |
| `src/commands/keymap.ts`·`editorKeymap.ts`·`registry.ts`·`shortcuts.ts` | R2 |
| `src/engine/editing/operations.ts` | R2(붙임줄, 새 마디, 박자·조 범위), R4(오선 입력) |
| `src/engine/layout/trackScene.ts` | R2(붙임줄 호), R3(높이), R4(오선 분리·옛 코드 삭제) |
| `src/engine/layout/pageLayout.ts`·`systemBreaker.ts`·`measureContents.ts` | R3, R8(재사용) |
| `src/engine/render/smufl.ts` | R3, R4 |
| `src/engine/audio/*` | R2(붙임줄 길이), R5, R8(Worker) |
| `src/engine/unroll/unrollScore.ts` | R5 |
| `src/engine/tools/transpose.ts` | R7 |
| `src/io/nativeScore.ts` → `fileFormat.ts` | R1, 이후 버전마다 |
| `src/io/musicXml.ts`, `midi.ts`, `pdfExport.ts` | R6에서 새 파일로 교체 후 삭제 |
| `src/io/asciiTab.ts` | R1(가져오기), R6(내보내기) |
| `src/app/App.tsx` | R1(방어막·복구), R8(레이아웃 입력) |
| `src/app/controllers/useEditorController.ts` | R2, R7 |
| `src/app/controllers/useFileController.ts` | R1, R6 |
| `src/app/controllers/usePlaybackController.ts` | R5, R8 |
| `src/ui/shell/EditorShell.tsx` | R3(도구줄), R5(LCD), R9 |
| `src/ui/styles/*.css` | R3, R6(인쇄), R9(포커스) |

---

## 문서 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 1.0 | 2026-11-23 | 점검 보고서(2026-11-13)를 바탕으로 처음 작성. 결정 1~7은 추천안을 전제로 함 |

