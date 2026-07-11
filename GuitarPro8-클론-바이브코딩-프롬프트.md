# Guitar Pro 8 카피 웹앱 — 바이브코딩 마스터 플랜

> **이 문서는** Guitar Pro 8 공식 사용자 매뉴얼(334페이지) 전체를 분석하여 만든, **단계별 바이브코딩 프롬프트 모음**입니다.
> 각 Phase의 프롬프트를 순서대로 AI 코딩 어시스턴트(Claude Code 등)에 붙여넣으면서 개발을 진행하세요.
>
> **함께 제공되는 파일**: `specs/` 폴더에 매뉴얼 전체를 도메인별로 정리한 상세 기능 명세서 6개가 있습니다.
> 각 Phase 프롬프트가 어떤 명세서를 컨텍스트로 첨부해야 하는지 명시되어 있습니다 — **반드시 함께 첨부하세요.**
> 명세서에는 매뉴얼의 모든 수치(틱 해상도, 단축키, 옵션 범위 등)가 담겨 있어 AI가 추측 없이 정확히 구현할 수 있습니다.

| 명세서 | 내용 |
|---|---|
| `specs/01-UI-구조와-내비게이션.md` | 6패널 레이아웃, 툴바 15그룹, LCD, 탭바, 홈페이지, 표시 모드 6종, 환경설정 5탭 |
| `specs/02-악보-데이터모델과-편집.md` | Score→Track→Bar→Voice→Beat→Note 계층, 튜닝/카포, 편집 커널, 복붙, 자동화, 드럼 |
| `specs/03-기보법-심볼과-이펙트.md` | 마디/노트 심볼 전체, 이펙트 40여 종, 반복/디렉션 언롤링 규칙, 가사, 스타일시트 60+옵션 |
| `specs/04-오디오-엔진과-재생.md` | RSE/MIDI 이중 엔진, 재생/루프/속도도구, 사운드보드, 이펙트 체인, 오디오 트랙 싱크 |
| `specs/05-파일-임포트-익스포트.md` | .gp 포맷 계보, MIDI/MusicXML/ASCII 임포트, 오디오/PDF/PNG/SVG 익스포트, 파일 보호 |
| `specs/06-도구와-부가기능.md` | 코드/스케일 엔진, 트랜스포즈, 악기 뷰 3종, 튜너, 커맨드 팔레트, **전체 단축키 표** |

---

## 0. 시작하기 전에

### 0.1 바이브코딩 진행 수칙 (중요)

1. **한 세션 = 한 Phase.** 각 Phase가 끝나면 완료 기준을 직접 확인하고 git 커밋 후 다음 세션을 시작하세요. 컨텍스트가 길어지면 품질이 떨어집니다.
2. **매 세션 시작 시 "마스터 컨텍스트 프롬프트"(§2)를 먼저 붙여넣고**, 이어서 해당 Phase 프롬프트 + 지정된 명세서 파일을 첨부하세요.
3. **완료 기준(✅)을 AI에게 자가 검증시키세요.** "완료 기준을 하나씩 실제로 실행/확인해서 결과를 보고해줘"라고 요청하면 됩니다.
4. **작동하는 최소 단위를 우선하세요.** 각 Phase는 "실행해서 눈으로 확인 가능한 증분"으로 설계되어 있습니다. 렌더링이 완벽하지 않아도 다음 Phase로 넘어가고, 나중에 다듬으세요.
5. **git은 Phase 0에서 바로 초기화**하고, Phase마다 커밋하세요. 잘못되면 되돌릴 수 있는 안전망이 바이브코딩의 핵심입니다.
6. 프롬프트를 수정해도 됩니다. 특히 `[선택]` 표시가 붙은 부분은 취향/우선순위에 따라 빼거나 바꾸세요.

### 0.2 법적 유의사항 (짧게)

- 이 프로젝트는 **기능의 재구현(클론)**입니다. Guitar Pro의 **상표/로고/아이콘/사운드뱅크 샘플/mySongBook 콘텐츠를 복제하면 안 됩니다.**
- UI 구조·단축키·파일 포맷 호환 같은 "기능적 요소"의 재구현은 일반적으로 허용되는 영역이지만, 상용 배포 시에는 별도 법률 검토를 권합니다. 학습·개인용으로는 문제 없습니다.
- 사운드는 공개 라이선스 사운드폰트(FluidR3 GM 등)를 사용하고, 앱 이름/브랜딩은 별도로 지으세요.

### 0.3 전체 로드맵 한눈에 보기

| Phase | 내용 | 산출물 | 난이도 |
|---|---|---|---|
| 0 | 프로젝트 부트스트랩 | 실행되는 빈 앱 + 아키텍처 골격 | ★ |
| 1 | 도메인 데이터 모델 + 불변식 엔진 | 타입 정의 + 검증기 + 테스트 | ★★ |
| 2 | 악보 렌더링 엔진 (타브+오선) | 악보가 화면에 그려짐 | ★★★★★ |
| 3 | 편집 커널 (커서·입력·Undo) | 키보드로 악보 작성 가능 | ★★★★ |
| 4 | 메인 UI 셸 (6패널 레이아웃) | GP8과 같은 화면 구성 | ★★★ |
| 5 | 기보 심볼 & 이펙트 표기 전체 | 벤드/슬라이드/해머온 등 표기 | ★★★★ |
| 6 | 재생 엔진 (스케줄러+신스) | 악보가 소리로 재생됨 | ★★★★★ |
| 7 | 이펙트 오디오 해석 + 믹서 + 자동화 | 이펙트가 소리에 반영, 트랙 믹싱 | ★★★★ |
| 8 | 트랙 시스템 심화 (위저드·튜닝·드럼·보이스) | 멀티트랙 밴드 스코어 작성 | ★★★★ |
| 9 | 도구 모음 (코드·스케일·튜너·악기 뷰) | 연습/작곡 보조 도구 | ★★★ |
| 10 | 커맨드 레지스트리 + 팔레트 + 전체 단축키 | Ctrl+E 커맨드 팔레트 | ★★★ |
| 11 | 스타일시트 + 표시 모드 + 디자인 모드 | 렌더링 커스터마이징 | ★★★ |
| 12 | 파일 임포트/익스포트 | 저장/열기/PDF/MIDI/MusicXML | ★★★★ |
| 13 | 홈페이지·멀티문서·환경설정·오디오 트랙 | 제품 수준 마무리 | ★★★ |

> **MVP 지름길**: 최소한의 "쓸 수 있는 앱"이 목표라면 **Phase 0→1→2→3→4→6→12(저장/열기만)** 순서로 먼저 관통한 뒤 나머지를 채우세요.

---

## 1. 기술 스택 결정 (프롬프트에 반영됨)

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **React 18 + TypeScript + Vite** | 생태계, AI 어시스턴트의 숙련도 |
| 상태 관리 | **Zustand + immer** | 문서 상태 트리 + 커맨드 패턴 undo에 적합 |
| 악보 렌더링 | **자체 SVG 엔그레이빙 엔진 + SMuFL 폰트(Bravura)** | 화면=인쇄=PDF=SVG 단일 렌더 경로. GP8의 WYSIWYG 원칙 재현 |
| 오디오 | **Web Audio API + 사운드폰트 샘플러(sf2/사전 변환 샘플)** | RSE 대체. 이펙트 체인은 Web Audio 노드 그래프 |
| MIDI | **Web MIDI API** | MIDI 출력/스텝 입력 캡처 |
| 파일 | **자체 네이티브 포맷(ZIP+JSON, 확장자 .gpw)** + MusicXML/MIDI/ASCII | .gp 바이너리 파싱은 후순위(부록 D 참고) |
| 테스트 | Vitest(단위) + Playwright(E2E) | 언롤링·검증기 등 순수 로직 회귀 방지 |

> **대안 경로(부록 D)**: 오픈소스 [alphaTab](https://alphatab.net)은 .gp 파일 파싱+렌더링+재생을 제공합니다. "빠른 결과물"이 목표라면 alphaTab을 코어로 쓰는 하이브리드 전략도 가능합니다. 이 문서의 프롬프트들은 **자체 구현 경로**를 기준으로 작성되었으며, 부록 D에 alphaTab 활용 변형 프롬프트가 있습니다.

---

## 2. 마스터 컨텍스트 프롬프트 (매 세션 시작 시 붙여넣기)

```
너는 지금부터 "Guitar Pro 8 클론 웹앱" 프로젝트의 시니어 개발자다.

## 프로젝트 개요
Guitar Pro 8(기타 타브+오선 악보 편집/재생 데스크톱 앱)의 기능을 웹에서 재현한다.
공식 매뉴얼을 분석한 도메인 명세서(specs/*.md)가 유일한 기능 기준(single source of truth)이다.
명세서와 코드가 충돌하면 명세서가 우선이다. 명세서에 없는 동작은 임의로 추가하지 말고 질문하라.

## 기술 스택
- React 18 + TypeScript(strict) + Vite, 상태는 Zustand + immer
- 악보 렌더링: 자체 SVG 엔그레이빙 엔진 + Bravura(SMuFL) 음악 폰트
- 오디오: Web Audio API(사운드폰트 샘플러 + 노드 그래프 이펙트), Web MIDI API
- 테스트: Vitest, E2E는 Playwright

## 절대 아키텍처 원칙 (모든 코드가 준수)
1. [단일 커맨드 레지스트리] 메뉴바·툴바·에디션 팔레트·커맨드 팔레트·단축키는 전부
   하나의 커맨드 정의 테이블 { id, label, shortcut, contextPredicate, execute }를 소비한다.
   UI 컴포넌트에 비즈니스 로직을 직접 넣지 않는다.
2. [문서 모델 정규화] Score → MasterBars[](전 트랙 공유: 박자표/조표/반복/섹션/템포자동화)
   + Tracks[] → Bars[] → Voices[4] → Beats[] → Notes[]. 모든 트랙은 항상 같은 마디 수(불변식).
   내부 시간축은 480 ticks = 4분음표.
3. [편집 = 순수 함수 + 트랜잭션] 모든 편집은 (state, command) => newState 순수 변환이며,
   마디 삽입/삭제 같은 전 트랙 변경도 undo 스택에 1개 트랜잭션으로 기록된다 (Ctrl+Z/Ctrl+Y).
4. [뷰 동기화] 커서/선택 상태는 단일 스토어에 있고 워크스페이스(악보)·글로벌 뷰·LCD가
   전부 그것을 구독한다. 타브/오선/슬래시는 같은 노트 모델의 투영이며 어느 쪽에서 편집해도
   즉시 전체 반영된다.
5. [렌더러 = f(문서, 스타일시트, 뷰상태)] 렌더링은 부수효과 없는 레이아웃 파이프라인이다.
   화면·인쇄·PDF·PNG·SVG 익스포트가 같은 SVG 씬 그래프를 공유한다.
6. [표기와 재생의 분리] 심볼은 note/beat/bar/masterBar 중 하나에 부착되는 데이터이고,
   렌더러와 오디오 스케줄러가 같은 데이터를 각자 해석한다.

## 코딩 규칙
- TypeScript strict, any 금지. 도메인 타입은 src/model/에 집중.
- 파일당 300줄 이내를 지향하고, 순수 로직(레이아웃/언롤링/검증)은 React와 분리해 테스트 가능하게.
- 모든 수치(단축키, 범위, 기본값)는 명세서 값을 그대로 사용. 추측 금지.
- UI 문구는 영어(GP8 원본과 동일), 주석은 한국어 허용.

이제 이번 세션의 작업 지시를 기다려라.
```

---

## Phase 0 — 프로젝트 부트스트랩 & 아키텍처 스캐폴드

- **🎯 목표**: 실행되는 빈 앱 + 폴더 구조 + 커맨드 레지스트리/스토어 골격.
- **📎 첨부**: (명세서 불필요)
- **⏱ 예상**: 1세션

### 💬 프롬프트

```
Guitar Pro 8 클론 웹앱 프로젝트를 부트스트랩하라.

1. Vite + React 18 + TypeScript(strict) 프로젝트를 생성하고 git 저장소를 초기화하라.
   패키지: zustand, immer, vitest, @types/node. UI 스타일은 일단 순수 CSS(모듈)로.

2. 다음 폴더 구조를 만들고 각 폴더에 책임을 설명하는 README.md를 넣어라:
   src/
     model/        # 도메인 타입 + 순수 편집 함수 (React 무관)
     engine/
       layout/     # 악보 레이아웃(엔그레이빙) 파이프라인
       render/     # SVG 렌더러
       audio/      # Web Audio 재생 엔진
       unroll/     # 반복/디렉션 언롤링
       validate/   # 불변식/오류 검증기
     commands/     # 단일 커맨드 레지스트리 (id, label, shortcut, contextPredicate, execute)
     store/        # Zustand 스토어 (document, view, playback, preferences)
     ui/
       shell/      # 6패널 레이아웃 셸
       panels/     # 팔레트/인스펙터/글로벌뷰
       dialogs/    # 편집 다이얼로그들
       widgets/    # LCD, 트랜스포트 등
     io/           # 파일 임포트/익스포트
     assets/       # Bravura 폰트 등

3. 커맨드 레지스트리 코어를 구현하라 (src/commands/registry.ts):
   - Command 인터페이스: { id: string, label: string, category: string,
     shortcut?: { win: string, mac: string }, contextPredicate?: (state) => boolean,
     execute: (state, args?) => void }
   - registerCommand / getCommand / getAllCommands / executeCommand(id, args)
   - 키보드 단축키 디스패처(src/commands/shortcuts.ts): keydown 이벤트를 커맨드로 매핑.
     Shift 조합 문자키('?', '%', '[', ']', '<', '>')는 event.key 기준으로 매칭할 것.
     포커스 스코프 개념(global | workspace | dialog | palette)을 지원할 것 — 나중에
     "이 창이 포커스일 때만 활성"인 단축키가 많다.

4. Zustand 스토어 4개의 골격을 만들라: documentStore(빈 Score), viewStore(커서/선택/줌),
   playbackStore(정지 상태), preferencesStore(기본값).

5. App.tsx에 임시 화면을 만들어라: "Guitar Pro Clone — Phase 0" 텍스트 + 등록된 커맨드
   목록을 보여주는 디버그 패널. 데모용으로 "app.about" 커맨드 1개를 등록하고 버튼으로 실행되게.

6. vitest 셋업 후 registry에 대한 단위 테스트 3개(등록/실행/contextPredicate 필터)를 작성해 통과시켜라.

완료 후: npm run dev로 실행 화면을 확인하고, npm test 결과를 보고하라. git 커밋(메시지: "Phase 0: bootstrap")까지 수행하라.
```

### ✅ 완료 기준
- [ ] `npm run dev` 실행 시 데모 화면 표시
- [ ] `npm test` 통과 (registry 테스트 3개)
- [ ] 폴더 구조 + README 존재, git 커밋 완료

---

## Phase 1 — 도메인 데이터 모델 & 불변식 엔진

- **🎯 목표**: 매뉴얼 그대로의 악보 데이터 모델(TypeScript 타입 + 팩토리 + 검증기). 이후 모든 Phase의 토대.
- **📎 첨부**: `specs/02-악보-데이터모델과-편집.md`, `specs/03-기보법-심볼과-이펙트.md`(§11 데이터 모델 계층 부분)
- **⏱ 예상**: 1~2세션

### 💬 프롬프트

```
첨부한 명세서(02-악보-데이터모델과-편집.md)의 §1, §21, §22를 기준으로
src/model/ 에 도메인 데이터 모델 전체를 구현하라.

1. 타입 정의 (src/model/types.ts — 명세서 수치를 정확히 반영):
   - Score: { meta: SongInfo(10개 필드: title, artist, subtitle, album, words, music,
     copyright, transcriber, notice, instructions), masterBars: MasterBar[], tracks: Track[],
     audioTrack?: AudioTrackRef, stylesheet: Stylesheet(일단 빈 객체 placeholder),
     documentSettings: { zoom, displayMode, engine } }
   - MasterBar(전 트랙 공유): { timeSignature: {numerator, denominator, beamingPreset},
     keySignature: {key, mode: 'major'|'minor'}, tripletFeel, freeTime, doubleBar,
     repeatOpen: boolean, repeatClose: number(패스 수, 0=없음),
     alternateEndings: number(비트마스크, 패스 1~8), section?: {letter, name, boxed},
     directionTargets: DirectionTarget[](Coda|DoubleCoda|Segno|SegnoSegno|Fine),
     directionJumps: DirectionJump[], fermatas: {beatTick, glyph, tempoScale}[] }
   - Track: { id, name, shortName, color, icon, notationTypes: ('standard'|'tab'|'slash'|'numbered')[],
     staffConfig: 'single'|'grand'(그랜드 스태프 분할점 C3), tuning: Tuning,
     transpositionTonality, sounds: SoundRef[], engine: 'RSE'|'MIDI',
     interpretation: { playingStyle: 'Pick'|'Finger'|'Picking'|'BassSlap',
       palmMuteIntensity, accentuation, autoLetRing, autoBrush, stringed },
     chordLibrary: ChordDiagram[], lyricsLines: LyricsLine[](최대 5줄, {text, firstBar, visible}),
     automations: Automation[], bars: Bar[] }
   - Tuning: { strings: number[](MIDI 피치, 3~10현), capo, partialCapo: {fret, strings},
     label, accidentalPreference: 'sharp'|'flat' }
   - Bar: { voices: [Voice, Voice, Voice, Voice] }  // 항상 4슬롯 고정
   - Voice: { beats: Beat[] }
   - Beat: { duration: 1|2|4|8|16|32|64, dots: 0|1|2, tuplet?: {n, m, parent?}(중첩 트리),
     rest: boolean, graceNotes: GraceNote[], notes: Note[],
     // 비트 레벨 이펙트(명세서 03 §11 부착 레벨 기준):
     whammy?: BendCurve, brush?: {direction, speed, delay}, arpeggio?: {direction, speed, delay},
     tapping, slash, barVibrato: 'none'|'slight'|'wide', pickstroke, text?, timer?,
     chordId?, dynamicHairpin?: {type: 'cresc'|'decresc'}, ottava }
   - Note: { string, fret, midiPitch(파생 캐시), tieOrigin/tieDestination(참조),
     accidental: 'none'|'sharp'|'flat'|'natural'|'doubleSharp'|'doubleFlat',
     forceAccidental(주의 임시표), dynamic: 0..7(ppp~fff 8단계),
     // 노트 레벨 이펙트:
     ghost, accent: 'none'|'accent'|'heavy', staccato, letRing, palmMute, deadNote,
     hopo, slide?: SlideType(6종), bend?: BendCurve(포인트 배열, 1/4음 단위 0~12),
     trill?: {secondFret, speed}, harmonic?: {type: 'natural'|'artificial'|'tapped'|'pinch'|'semi', touchFret},
     vibrato: 'none'|'slight'|'wide', tremoloPicking?: 8|16|32,
     ornament?: 'upperMordent'|'lowerMordent'|'turn'|'invertedTurn',
     leftFinger?, rightFinger?, fadeIn, fadeOut, volumeSwell, wah?: 'open'|'closed',
     slap, pop, golpe?: 'finger'|'thumb', pickscrape?, deadSlapped, showStringNumber }
   - Automation: { type: 'tempo'|'volume'|'pan', scope: 'track'|'master',
     points: {tick, value, transition: 'constant'|'progressive', label?}[] }
     (tempo는 항상 master 전용, 소수점 bpm 허용, 30bpm 미만 허용)
   - 시간 단위: TICKS_PER_QUARTER = 480 상수.

2. 팩토리 함수 (src/model/factory.ts):
   - createEmptyScore(): 트랙 0개 + 마스터바 1개(4/4, C major)
   - createTrack(instrumentPreset): 기본 튜닝(기타 EADGBE 6현 등) + 빈 마디를 masterBars 수만큼
   - createBar/createBeat/createNote 기본값 헬퍼

3. 파생 계산 (src/model/derive.ts — 전부 순수 함수 + 테스트):
   - beatDurationTicks(beat): duration+dots+tuplet(중첩 재귀 비율 곱) → tick
   - barTheoreticalTicks(masterBar): 박자표 → tick
   - noteMidiPitch(note, track): stringPitch + capo + fret (partial capo 규칙 포함)
   - writtenPitch(note, track, options): 실음 → 표기 피치
     (transposition tonality, concert tone, 8va류를 순수 함수 하나로)

4. 불변식 검증기 (src/engine/validate/):
   - validateBarDurations(score): 각 트랙×마디×보이스의 실제 tick 합 vs 이론값 비교.
     불완전/초과 마디 목록 반환 { trackId, barIndex, voiceIndex, actual, expected }.
     Anacrusis 규칙: masterBar에 anacrusis 플래그가 있으면 첫/마지막 마디는 오류 제외.
     그레이스 노트는 duration 계산에서 제외(명세서 02 §9.5).
   - validateStructure(score): 모든 트랙의 bars.length === masterBars.length,
     노트의 보이스 단일 소속, simile 위치 제약(1마디 simile는 첫 마디 금지,
     2마디 simile는 1~2번 마디 금지) 등.

5. 단위 테스트 (vitest): 최소 15개 —
   튜플렛 중첩 tick 계산(트리플렛 안 퀸튜플렛), 점/겹점(+1/2, +3/4), 카포 피치,
   불완전 마디 검출, anacrusis 예외, 4/4↔6/8 이론 tick, 그레이스 제외 등.

전부 React와 무관한 순수 TS로 작성하라. 완료 후 npm test 결과를 보고하고 커밋하라.
```

### ✅ 완료 기준
- [ ] `src/model/types.ts`에 명세서 수치(4보이스, 3~10현, 튜플렛 2~13+n:m, 다이내믹 8단계, 480tick)가 정확히 반영
- [ ] 검증기가 불완전 마디를 정확히 검출 (테스트 통과)
- [ ] 테스트 15개 이상 통과

### ⚠️ 주의
- 심볼의 **부착 레벨(note/beat/bar/masterBar)**을 명세서 03 §11과 다르게 배치하면 이후 Phase 전체가 꼬입니다. 여기서 확실히 잡으세요.

---

## Phase 2 — 악보 렌더링 엔진 (타브 + 오선)

- **🎯 목표**: Score 객체를 SVG 악보(타브+오선 병기)로 그리는 엔그레이빙 엔진. **이 프로젝트에서 가장 어려운 부분** — 2~4세션에 나눠 진행.
- **📎 첨부**: `specs/03-기보법-심볼과-이펙트.md`, `specs/01-UI-구조와-내비게이션.md`(§4 표시 모드)
- **⏱ 예상**: 3~4세션 (2a: 레이아웃 파이프라인 / 2b: 오선·타브 글리프 / 2c: 빔·튜플렛·타이)

### 💬 프롬프트 2a — 레이아웃 파이프라인

```
악보 렌더링 엔진의 1단계(레이아웃 파이프라인)를 구현하라.

아키텍처 (src/engine/layout/):
  Score → [1] MeasureContents (마디별 비트 배치: tick → x 비례 폭, 최소 간격 보장)
        → [2] SystemBreaker (마디들을 시스템(줄)으로 분배 — 페이지 폭 기준 그리디,
              forcedBreak/preventBreak 오버라이드 반영)
        → [3] PageLayout (시스템들을 페이지로 분배, 여백/헤더 공간)
        → [4] SceneGraph (렌더 프리미티브 트리: StaffLine, Glyph, Text, Path, Rect...)
  각 단계는 순수 함수이며 중간 결과가 직렬화 가능해야 한다(테스트/캐싱 목적).

렌더 프리미티브에는 반드시 hit 메타데이터를 포함하라:
  { kind: 'note'|'beat'|'bar'|'header'|'timeSig'|'keySig'|'clef'|..., ref: {trackId, barIndex, voiceIndex, beatIndex, noteIndex?}, bbox }
  → Phase 3에서 클릭 히트테스트에 사용된다.

SVG 렌더러 (src/engine/render/SvgRenderer.tsx):
  SceneGraph → React SVG 엘리먼트. 뷰포트 가상화는 아직 불필요(페이지 단위 렌더).

음악 폰트: Bravura(SMuFL)를 assets에 포함하고 @font-face로 로드.
  SMuFL 코드포인트 상수 테이블(src/engine/render/smufl.ts)을 만들어라
  (음자리표 4종 G/F/C3/C4, 음표머리, 쉼표 7종, 임시표 5종, 페르마타 등).

이번 단계 목표 출력: 데모 Score(2트랙 × 8마디, 하드코딩)를
  - 오선 5줄 + 타브 6줄(현 수만큼) 병기
  - 마디 경계 바라인, 음자리표, 박자표, 조표
  - 음표는 일단 "머리만"(스템/빔 없이), 타브는 프렛 숫자
  로 그려 App.tsx에 표시하라. 페이지 모드(A4 세로, Vertical Page)로.

레이아웃 파라미터는 전부 src/engine/layout/metrics.ts 상수로 모아라
(스태프 간격, 마디 최소폭, 노트 간격 계수 등) — Phase 11 스타일시트가 이 값들을 오버라이드하게 된다.

단위 테스트: SystemBreaker(폭 초과 시 줄바꿈, forcedBreak), tick→x 매핑 단조성.
```

### 💬 프롬프트 2b — 음가 렌더링 (스템·빔·점·쉼표·튜플렛·타이)

```
렌더링 엔진 2단계: 리듬 표기를 완성하라.

1. 스템(기둥)과 플래그: duration 8 이상은 플래그, 스템 방향 자동 결정
   (오선 중앙선 기준, beat.stemDirection 오버라이드 지원 — auto|up|down).
2. 빔(beam) 그루핑: 박자표의 beamingPreset 기준 자동 그룹핑 + beat.beamMode
   오버라이드(auto|force|break|breakSecondary|forceGroup — 명세서 03 §5.7).
   2차 빔(16분 이하) 분리 지원. 표준 기보/드럼 기보의 빔 수평 강제 옵션 자리 마련.
3. 점/겹점, 쉼표 7종(whole~64th) 글리프 배치.
4. 튜플렛: 숫자+브래킷 렌더. 중첩 튜플렛은 브래킷 이중 표시.
5. 타이: 같은 현/피치의 인접 노트를 아치로 연결(시스템 경계를 넘는 타이 분할 포함).
6. 타브 리듬 표기: 타브 아래 스템/빔 미니 리듬(보이스별 above/below/hidden 설정 자리).
7. 멀티보이스 렌더: voice 1 스템 위/voice 2 스템 아래 관례. 비활성 보이스는 회색(#999).
8. 마디 오류 표시: Phase 1 검증기 결과를 받아 불완전/초과 마디를 빨간색으로 렌더
   (현재 편집 중인 마디 제외 파라미터).

데모 Score를 확장해 다음이 모두 보이게 하라: 점4분+8분 조합, 16분 빔 그룹,
셋잇단, 중첩 튜플렛(트리플렛 안 퀸튜플렛), 온음표~64분음표, 쉼표들, 타이, 2보이스 마디,
일부러 만든 불완전 마디(빨간색 확인).

시각 회귀 방지를 위해 대표 케이스 5개를 SVG 스냅숏 테스트로 고정하라.
```

### ✅ 완료 기준
- [ ] 데모 악보가 타브+오선 병기로 그려짐 (음자리표/박자표/조표/바라인 포함)
- [ ] 빔·튜플렛·타이·점음표·쉼표·멀티보이스 렌더 확인
- [ ] 불완전 마디 빨간색 표시
- [ ] hit 메타데이터가 SceneGraph에 존재 (Phase 3 준비)

### ⚠️ 주의
- 엔그레이빙 품질은 끝이 없습니다. **"읽을 수 있는 수준"에서 멈추고** Phase 3으로 진행 후, 거슬리는 부분만 나중에 다듬으세요.
- GP8의 인그레이빙은 Elaine Gould의 *Behind Bars* 규칙 기반입니다(명세서 02 §1.2). AI에게 "Behind Bars 관례를 따르라"고 지시하면 세부 판단 품질이 올라갑니다.

---

## Phase 3 — 편집 커널: 커서 · 선택 · 키보드 입력 · Undo

- **🎯 목표**: GP8의 핵심 UX인 **키보드 우선 악보 입력**. 이 Phase가 끝나면 "쓸 수 있는 에디터"가 됩니다.
- **📎 첨부**: `specs/02-악보-데이터모델과-편집.md` (§6, §9, §11, §12, §13, §19, §20)
- **⏱ 예상**: 2~3세션

### 💬 프롬프트

```
편집 커널을 구현하라. 명세서 02의 §9(음표 입력), §11(선택), §19(커서)를 정확히 따를 것.

1. 커서 모델 (viewStore):
   cursor = { trackId, barIndex, voiceIndex(0~3), beatIndex, string(타브)|staffLine(오선), staffKind: 'tab'|'standard' }
   - 악보 클릭 → 커서 이동만 (노트 입력 아님 — 명세서 02 §9.1 "클릭은 커서 이동만").
     Phase 2의 hit 메타데이터로 히트테스트.
   - 커서 렌더: 활성 보이스 색상 사각형(보이스별 색: yellow/green/pink/purple 계열).
     상대 노테이션(타브↔오선)의 대응 노트에는 회색 사각형 표시.

2. 키보드 내비게이션 (커맨드 레지스트리에 등록, 명세서 02 §19 표 그대로):
   ←/→ 비트 이동, ↑/↓ 현(라인) 이동, Tab/Shift+Tab 타브↔오선 전환,
   Home/End 마디 시작/끝, Ctrl+Home/End 첫/마지막 마디,
   Ctrl+↑/↓ 트랙 전환, Ctrl+G Go To 다이얼로그(마디 번호 입력).
   ★ 특수 규칙: 악보 맨 끝에서 → 키를 누르면 새 마디가 자동 생성된다(전 트랙 동시).
   ★ 불완전 마디에서 → 이동 시 직전 비트와 같은 음가의 새 비트 자동 생성.

3. 노트 입력 (명세서 02 §9.2 표 그대로):
   - 타브 커서: 숫자 0~9 = 프렛 입력. 2자리 프렛은 짧은 입력 지연(300ms 내 연속 입력)으로 처리.
   - 오선 커서: 숫자 1~9 = 배치할 현 선택, 0 = 최적 현 자동 배치.
   - +/- = 음가 증감 (Preferences의 invertPlusMinus 반전 옵션 반영).
   - R = 쉼표, L = 타이, Shift+L = 비트 타이, Shift+. = 점, Ctrl+. = 겹점, Shift+/ = 셋잇단.
   - Backspace = 노트 삭제, Shift+Del = 비트 삭제, Ctrl+Del = 마디 삭제(전 트랙),
     Ins = 마디 삽입(커서 앞, 전 트랙), Ctrl+Ins = 비트 삽입.
   - C = 마지막 비트 복사.
   - Alt+↑/↓ = 노트를 이웃 현으로 이동(피치 유지), Alt+Shift+↑/↓ = 반음 이동.
   - 임시표: Ctrl+9 샤프, Ctrl+7 플랫, Ctrl+8 내추럴, Ctrl+Alt+9/7 더블, Ctrl+Alt+8 이명동음.
   - 입력/삭제 후 매번 검증기 실행 → 빨간 마디 갱신.

4. 선택 모델 (명세서 02 §11):
   selection = { anchor: cursorPos, head: cursorPos } (트랙×마디×비트 범위)
   - 마우스 드래그 선택(파란색 하이라이트), Shift+화살표 확장(비트), Ctrl+Shift+화살표(마디),
     Shift+Home/End, Ctrl+A 트랙 전체, 트리플 클릭 = 트랙 전체.
   - 선택 가장자리 드래그 리사이즈(양방향 화살표 커서).

5. 클립보드 (명세서 02 §12):
   - Ctrl+C/X/V 단일 트랙 복붙(바 구조 미포함, 멀티보이스 포함).
   - Ctrl+Shift+C/X 멀티트랙 복사(바 구조 포함).
   - Ctrl+Shift+V Special Paste 다이얼로그: 반복 횟수 N, insert/overwrite,
     요소 필터 6종(코드/텍스트/타이머/트랙 자동화/마스터 자동화/섹션).
   - 클립보드 페이로드에 mode: 'single'|'multitrack' 태그.

6. Undo/Redo (Ctrl+Z / Ctrl+Y):
   - 커맨드 패턴: 모든 편집 커맨드는 트랜잭션 단위로 undo 스택에 기록.
   - 마디 삽입/삭제(전 트랙) 및 이후 위저드류도 1 트랜잭션 = 1 undo.
   - documentStore에 dirty 플래그(undo 스택 기준).

E2E 테스트(Playwright) 1개: "빈 스코어에 기타 트랙 추가 → 숫자키로 8마디 멜로디 입력
→ 셋잇단 적용 → Ctrl+Z 3회 → Ctrl+Y 1회" 시나리오가 데이터/렌더 모두 일관되는지.
```

### ✅ 완료 기준
- [ ] 마우스 클릭으로 커서 이동, 숫자키로 프렛 입력, 화살표 이동이 GP8과 동일하게 동작
- [ ] 맨 끝 → 키 = 새 마디 자동 생성
- [ ] 타브에서 입력한 노트가 오선에 즉시 반영(역방향도)
- [ ] 선택/복붙/Undo 동작

---

## Phase 4 — 메인 UI 셸: 6패널 레이아웃

- **🎯 목표**: GP8의 화면 구성 재현 — 툴바, 탭바, 에디션 팔레트, 워크스페이스, 인스펙터, 글로벌 뷰.
- **📎 첨부**: `specs/01-UI-구조와-내비게이션.md`
- **⏱ 예상**: 2세션

### 💬 프롬프트

```
명세서 01을 기준으로 메인 UI 셸을 구현하라. GP8과 동일한 6패널 구성이다.

1. 레이아웃 (src/ui/shell/): CSS Grid 기반.
   ┌─ Toolbar (상단, 항상 표시) ─────────────────┐
   ├─ Tab bar (툴바 아래, 항상 표시) ─────────────┤
   ├ Palette │ Workspace(중앙, 스크롤) │ Inspector ┤
   ├─ Global View (하단, 수직 리사이즈 드래그) ────┘
   패널 토글: F2(팔레트), F5(Song Inspector), F6(Track Inspector), F8(글로벌 뷰).
   토글 상태는 preferencesStore에 영속(localStorage).
   최소 뷰포트 1024×768 기준으로 설계.

2. 툴바 (명세서 01 §2.1 — 15개 그룹, 왼쪽→오른쪽 순서 그대로):
   홈 아이콘 / 패널 토글들 / 줌 / 표시 모드 / Undo·Redo / Print / 트랜스포트(5버튼:
   처음으로·이전 마디·재생/정지·다음 마디·끝으로) / LCD / 루프·속도 / 전역 조성 /
   오디오 트랙 / 악기 뷰 / 튜너 / Line-in / (Fretlight 자리 — 기본 숨김).
   ★ 반응형: ResizeObserver로 창이 좁아지면 우선순위 낮은 그룹부터 숨김(Print 먼저).
   ★ 현재 트랙 색상이 툴바에 표시. 버튼 툴팁에 단축키 병기.
   아직 미구현 기능의 버튼은 disabled로 두되 자리는 만들 것.

3. LCD 위젯 (명세서 01 §2.2): 트랙명(클릭=트랙 전환 팝업) / 템포 값 /
   현재 마디 실제·이론 길이(불완전 시 경고 + 호버 툴팁에 어느 보이스가 불완전한지) /
   카운트인·메트로놈 토글 + 설정 기어(다이얼로그 자리만).

4. 탭바 (명세서 01 §2.3): 멀티 문서. dirty 파일은 탭 우측 ● , 호버 시 Save/Close 버튼,
   Ctrl+Tab/Ctrl+Shift+Tab 전환, + 버튼(New/Open 메뉴), 우클릭 컨텍스트(Close all).
   documentStore를 다중 문서 구조로 리팩터: documents: Map<id, DocState>, activeId.
   ※ 브라우저 예약 단축키 주의: Ctrl+W 대신 Ctrl+F4와 탭 X 버튼을 기본으로, PWA 설치 시에만 Ctrl+W 시도.

5. 에디션 팔레트 (좌측, 명세서 01 §2.4): 10개 그룹 접이식 세로 패널 —
   보이스 셀렉터 / 멀티보이스 / 디자인모드 / 가사 / 코드 / Bar symbols / Note symbols /
   Effect symbols / Notation symbols / Automation symbols.
   지금은 Note symbols 그룹(음가 7종, 점/겹점, 셋잇단, 타이, 임시표 5종, 다이내믹 8종)만
   실제 커맨드에 연결하고 나머지는 disabled 아이콘으로 배치.
   ★ 아이콘 규약: 우하단 삼각형(▸) = 우클릭/롱클릭 추가 설정. 공통 핸들러를 만들어 둘 것.
   ★ 모드형 버튼(셋잇단 등)은 활성 시 파란색.

6. 인스펙터 (우측): Song Inspector(곡 정보 10필드 편집 → score.meta 양방향 바인딩,
   Concert tone 버튼 자리) / Track Inspector(이름·색·아이콘, 노테이션 타입 체크박스,
   튜닝 요약 표시, Interpretation 옵션 자리). F5/F6으로 각각 토글.

7. 글로벌 뷰 (하단, 명세서 01 §2.7): 좌측 = 트랙 리스트(색상+이름, 클릭=커서 이동,
   Add Track 버튼, 위/아래 이동), 우측 = 마디 그리드 미니맵(트랙×마디 셀, 클릭 =
   트랙+마디 동시 선택, 현재 커서 하이라이트, 섹션 마커 행, 섹션 더블클릭=섹션 선택,
   Alt+휠 = 수평 스크롤). 트랙×마디가 많아질 수 있으니 그리드는 canvas 또는 가상화로.
   뮤트/솔로/볼륨 등 믹서 컨트롤은 자리만(Phase 7).

8. 메뉴바: File/Edit/Track/Bar/Note/Effects/Section/Tools/Sound/View/Window/Help
   12개 메뉴를 커맨드 레지스트리에서 데이터 기반으로 생성. 미구현 커맨드는 회색.

전부 다크 크롬 + 밝은 악보 용지 테마(GP8 스타일)로 스타일링하라.
```

### ✅ 완료 기준
- [ ] 6패널 배치가 GP8과 동일, F2/F5/F6/F8 토글 동작
- [ ] 팔레트 Note symbols로 음가/점/임시표 편집 가능 (Phase 3 커맨드 재사용 확인)
- [ ] 글로벌 뷰 미니맵 클릭으로 트랙+마디 점프
- [ ] LCD가 커서 마디의 길이 상태를 실시간 표시
- [ ] 멀티 문서 탭 전환

---

## Phase 5 — 기보 심볼 & 이펙트 표기 전체

- **🎯 목표**: 매뉴얼의 모든 마디/노트/이펙트 심볼의 **데이터 입력 + 렌더링** (오디오 해석은 Phase 7).
- **📎 첨부**: `specs/03-기보법-심볼과-이펙트.md`
- **⏱ 예상**: 3~4세션 (5a: 마디 심볼 / 5b: 노트·이펙트 심볼 / 5c: 다이얼로그·가사)

### 💬 프롬프트 5a — 마디 레벨 심볼

```
명세서 03의 §1(마디 레벨 심볼)을 전부 구현하라. 데이터는 masterBar에 저장(전 트랙 공유).

구현 목록 (각각 팔레트 버튼 + 커맨드 + 단축키 + 렌더링):
1. 박자표 변경 다이얼로그(Ctrl+T): 분자/분모 + 빔 프리셋. 변경 지점에 더블 바라인 자동.
2. 조표 다이얼로그(Ctrl+K): 키+장단조. 렌더러에 조표 반영(임시표 전파 규칙 포함:
   임시표 효력은 해당 마디 끝까지).
3. 음자리표 다이얼로그: G/F/C3/C4 + 8va/8vb/15ma/15mb. transpose 토글
   (활성: 같은 소리 유지하도록 노트 재계산 / 비활성: 기보 유지·소리 변경).
4. Triplet feel (Ctrl+/): 모티프 선택 에디터. 악보에 스윙 표기 렌더.
5. Free time (Alt+Shift+L): 점선 바라인 + 괄호 박자표 렌더.
6. 더블 바라인, Simile 1마디(Shift+%)·2마디(Ctrl+%) — 위치 제약 검증(첫 마디 금지 등).
7. Repeat open([) / Repeat close(]): close는 패스 수 다이얼로그.
   렌더: 반복 바라인 + 패스 수 숫자(단, 정확히 2회면 숫자 숨김 — 명세서 03 §1.7).
8. Alternate endings: 패스 1~8 복수 선택 다이얼로그 → 볼타 브래킷 렌더.
9. Directions 에디터(D): 타깃 5종(Coda/DoubleCoda/Segno/SegnoSegno/Fine) +
   점프 목록(Da Capo, Dal Segno, Da Coda, al Coda/al Fine 계열 11종) 배치. 심볼 글리프 렌더.
10. Fermata(F): 비트 위치에 글리프 종류 + tempoScale 다이얼로그. 멀티트랙 심볼.
11. Anacrusis 토글, Multirest(Ctrl+R): 연속 쉼표 마디 축약 렌더.
12. 섹션 마커(Shift+Ins): letter+name 다이얼로그, [이름] 대괄호 = 박스 렌더.
    Section 메뉴에 섹션 목록 나열(클릭=점프), Ctrl+Alt+←/→ 섹션 간 이동.

★ 악보 직접 클릭 편집: 렌더된 박자표/조표/클레프/섹션/디렉션/볼타/repeat close/페르마타에
   hit 메타데이터를 달아, 호버 시 파란 하이라이트 + 클릭 시 해당 다이얼로그가 열리게 하라
   (명세서 02 §14 — 클릭 편집 가능 요소 15종의 공용 라우팅 구조로).
```

### 💬 프롬프트 5b — 노트/비트 레벨 이펙트 심볼

```
명세서 03의 §2~§5를 전부 구현하라. 부착 레벨(note/beat)을 명세서 그대로 지킬 것.

1. 단일 키 토글 이펙트 (커맨드 등록 + 팔레트 버튼 + 렌더 글리프):
   H 해머온/풀오프(피치 비교로 H/P 자동 판별, 슬러 렌더), Shift+H 레가토(슬러),
   S 레가토 슬라이드(+shift slide, slide in/out 4종은 팔레트 서브메뉴 — 총 6종, 사선/슬러 렌더),
   X 데드노트(x), O 고스트(괄호), ; 액센트, : 강액센트, ! 스타카토(점),
   i 렛링(점선 연장), P 팜뮤트(PM+점선), Shift+P 비트 팜뮤트,
   Y 내추럴 하모닉, Ctrl+Alt+Y 인공 하모닉(4종 서브타입: A.H./T.H./P.H./S.H. + 터치 프렛),
   V 비브라토(slight, 우클릭으로 wide — 작은 물결, 노트 끝까지),
   W/Ctrl+Alt+W 바 비브라토 slight/wide(비트 레벨, 큰 물결),
   N 트릴(둘째 프렛+속도 다이얼로그), " 트레몰로 피킹(우클릭: 8/16/32분),
   G 그레이스(before), Ctrl+Alt+G 그레이스(on-beat) — 현당 1개 제한, 마디 duration 제외,
   ) 태핑, ( 왼손 태핑, $ 슬랩, 팝, Shift+R 라스게아도(18모티프 선택 다이얼로그),
   Ctrl+D/U 브러시 다운/업(속도+딜레이 다이얼로그, 브러시 길이<비트 길이 검증),
   Ctrl+Shift+D/U 아르페지오, Shift+D/U 픽스트로크, < > 페이드인/아웃, Alt+< 볼륨 스웰,
   Ctrl+Alt+O/C 와우 open/close, 골페(finger/thumb), 픽스크레이프, 데드슬랩,
   Ped. 서스테인 페달(구간, 해제 * 자동 배치), 옥타브 기호(8va/8vb/15ma/15mb — 점선 브래킷,
   기보 시프트 + 실음 유지), 크레셴도/데크레셴도 헤어핀(구간 + 목표 다이내믹 지정 필수).

2. 벤드 다이얼로그(B) — 명세서 03 §4.11 정확히:
   - 드래그 가능한 포인트 커브 에디터 (SVG). 좌측 베이스 타입 버튼:
     bend / bend-release / prebend / prebend-bend / prebend-release / hold / release (7종 패밀리).
   - 최대 레벨 1/4음~3음, "Full"=온음, 해상도 1/4음. 선택 레벨이 타브 라벨("full", "1/2")에 반영.
   - 타이 연결 시 벤드가 전체 길이로 확장.
   - 트레몰로 바(Ctrl+Alt+V)는 같은 커브 에디터를 재사용(음수 다이브 허용, 비트 레벨).

3. 운지: 좌/우손 핑거링 다이얼로그(창이 포커스일 때만 활성인 자체 단축키 —
   좌손 T,0~4 / 우손 p,i,m,a,c), 현 번호 표시(오선 원 숫자), 바레(Shift+I: full/half+프렛+범위).

4. 렌더 규칙 디테일: 이펙트 텍스트("let ring", "PM", "w/bar" 등)는 스타일시트에서
   문구/폰트를 바꿀 수 있도록 상수 테이블(src/engine/render/symbolLabels.ts)로 분리.

5. 가사 에디터 (명세서 03 §6): 트랙당 최대 5줄, 줄별 시작 마디/visible.
   자동 분배 토크나이저: 공백·하이픈=음절 전환, +=결합, 연속 구분자=빈 비트,
   [대괄호]=악보 미표시. 렌더는 첫 스태프 아래.

각 이펙트당 데모 스코어에 예시 1개 이상을 넣어 시각 확인 페이지(/debug/symbols)를 만들라.
```

### ✅ 완료 기준
- [ ] 명세서 03 §3 팔레트 목록의 심볼이 전부 입력·렌더 가능
- [ ] 벤드 커브 에디터 동작 (7종 패밀리, 1/4음 단위)
- [ ] 반복/볼타/디렉션이 악보에 표기됨 (재생 해석은 Phase 6)
- [ ] /debug/symbols 페이지에서 전체 심볼 눈 검증

---

## Phase 6 — 재생 엔진: 스케줄러 + 신스 + 트랜스포트

- **🎯 목표**: 악보가 소리로 재생. 반복/디렉션 언롤링, 메트로놈/카운트인, 루프, 속도 도구까지.
- **📎 첨부**: `specs/04-오디오-엔진과-재생.md`, `specs/03-기보법-심볼과-이펙트.md`(§1.7~1.9 언롤링 규칙)
- **⏱ 예상**: 3세션 (6a: 언롤러+템포맵 / 6b: 신스+스케줄러 / 6c: 트랜스포트 UX)

### 💬 프롬프트 6a — 언롤러와 템포 맵 (순수 로직)

```
재생 준비 계층을 순수 TypeScript로 구현하라 (React/오디오 무관, 테스트 최우선).

1. 언롤러 (src/engine/unroll/):
   unrollScore(masterBars): PlaybackSegment[] — 반복/볼타/디렉션을 해석해
   마디 인덱스의 선형 시퀀스로 전개한다. 명세서 03 §1.7~1.9의 규칙을 전부 구현:
   - Repeat open/close: 패스 수만큼 반복, 중첩 반복 스택, 여러 close가 한 open 공유.
   - Alternate endings: 패스 번호 vs 비트마스크 대조 + 암묵 확장 규칙
     (엔딩 지정 마디 뒤의 미지정 마디들은 같은 패스에 속함).
   - Directions 상태 머신: Da Capo(anacrusis 시 2번 마디로), Dal Segno(첫 패스 무시),
     Dal Segno Segno, Da Coda(al Coda 선행 필요, 없으면 마지막 출현 시 자동 활성화),
     반복 내 Segno 점프=마지막 패스, Coda 점프=첫 패스, Fine=점프 1회 수행 후에만 정지,
     "Al ..." 지시는 다음 패스에서 타깃 해석 강제.
   단위 테스트 12개 이상: 명세서의 예시 시퀀스를 그대로 검증
   (1-2-1-2-3 / A-B-A-B-A-B-C / 중첩 A-B-B-C×3 / 볼타 1-2-1-3 / D.C. al Fine → A-B-C-D-A-B 등).

2. 템포 맵 (src/engine/audio/tempoMap.ts):
   buildTempoMap(unrolled, tempoAutomation, speedOverride): tick → seconds 변환 함수.
   - 자동화 포인트 transition: constant(계단) / progressive(선형 램프 — 구간 적분).
   - 소수점 bpm, 30bpm 미만 허용. TICKS_PER_QUARTER=480.
   - speedOverride: { mode: 'relative', percent: 10~300 } | { mode: 'fixedBpm', bpm: 10~300 }
     | { mode: 'progressive', from, to, loopCount, step } (스피드 트레이너).
   - 페르마타: 해당 비트 구간 로컬 템포 스케일. 트리플렛 필: 오프비트 타이밍 스윙 시프트.

3. 이벤트 컴파일러 (src/engine/audio/compile.ts):
   compilePlayback(score, unrolled, tempoMap): NoteEvent[] —
   { timeSec, durationSec, midiPitch, velocity(다이내믹 8단계 매핑), trackId, string, 이펙트 페이로드 }.
   - 타이 체인은 단일 지속 이벤트로 병합. 그레이스는 비트 직전/직후 고정 짧은 길이.
   - 트릴/트레몰로 피킹/장식음/라스게아도/브러시/아르페지오는 여기서 노트 시퀀스로 전개.
   - 오디오 노트 설정(duration 25~1200%, offset ±tick, velocity ±15dB) 반영.
   - 표기 전용 심볼 무시 목록(명세서 03 §4.34): pickscrape, dead slapped, 운지, 현번호, 바레.
```

### 💬 프롬프트 6b — 신스와 스케줄러

```
Web Audio 재생 계층을 구현하라.

1. 샘플러 (src/engine/audio/sampler.ts):
   - 무료 GM 사운드폰트(FluidR3 GM 또는 유사)를 악기별 샘플 세트로 사전 변환해
     public/sounds/에 배치하는 스크립트를 작성하라 (또는 js-synthesizer/soundfont2 파서 사용 —
     번들 크기와 라이선스를 보고하고 선택을 제안하라).
   - Instrument: 피치별 샘플 선택 + 피치 시프트(detune), ADSR 근사, velocity 레이어(있으면).
   - 최소 악기 세트: 어쿠스틱 기타(nylon/steel), 일렉 기타(clean/overdrive/distortion),
     베이스, 피아노, 드럼킷(GM 채널 10 매핑, 명세서 02 §17.3의 MIDI 27~87 표).

2. 스케줄러 (src/engine/audio/scheduler.ts) — lookahead 패턴:
   - setInterval 25ms 마다 audioContext.currentTime + 0.1s 윈도 안의 NoteEvent를
     AudioBufferSourceNode로 예약. 재생 위치는 currentTime 기준 역산.
   - seek: 예약 큐 플러시 후 새 위치부터 재스케줄 (재생 중단 없이 — GP8의
     "재생 중 악보 클릭 시 멈추지 않고 이어서" 동작).
   - 노드 그래프: source → trackGain → trackPan → masterGain → destination
     (이펙트 체인 자리는 Phase 7에서 삽입).

3. 트랜스포트 (playbackStore + 커맨드):
   - Space 재생/정지(커서 위치부터), Ctrl+Space 처음부터,
     Ctrl+←/→ 마디 되감기/빨리감기, Alt+←/→ 비트 스텝.
   - 선택 영역 재생: 선택이 있으면 그 구간만. F9 루프 토글(선택 구간 반복).
   - 재생 커서: rAF로 오디오 클록과 동기화된 커서 렌더 + 자동 스크롤(auto-follow).
     수동 스크롤 시 auto-follow 중단 → 워크스페이스 좌상단 "Resume auto-scroll" 버튼.
     Preferences 커서 스타일 4종(None/Smooth/Each note/Metronome) + 재생 마디 연노랑 하이라이트.
   - 재생 중 악보 클릭 = 정지 없이 그 지점부터 재생.

4. 메트로놈/카운트인 (LCD 설정과 연결):
   - 메트로놈: 박마다 클릭(다운비트 구분음). 독립 게인(볼륨 0 = 시각 전용).
   - 비주얼 메트로놈: 박마다 툴바 영역 플래시.
   - 카운트인: 재생 앞 N마디 프리롤(기본 1), "루프 사이 카운트인" 옵션.

5. 속도 도구 (툴바 루프·속도 그룹, 명세서 04 §1.5):
   - Relative speed: 프리셋 7개(25~100%) + 커스텀 10~300%. Ctrl+F9.
   - Fixed BPM: 템포 자동화 무시 단일 bpm 10~300 (오디오 트랙 존재 시 비활성).
   - Progressive(스피드 트레이너): 시작%/종료%/반복 수/스텝 — 루프 반복마다 증가.
   - 재생 중 +/- 키: 상대 5% / 고정 5bpm 스텝. 활성 시 툴바 컨트롤 파란색.

E2E: 8마디 데모 스코어(반복 1회 + 볼타 2개 포함)를 재생하면 언롤된 순서로
커서가 이동하고 소리가 나는지 확인하는 테스트.
```

### ✅ 완료 기준
- [ ] Space로 재생, 커서 추적/자동 스크롤, 재생 중 클릭 seek
- [ ] 반복·볼타·D.S. al Coda가 올바른 순서로 재생 (언롤러 테스트 통과)
- [ ] 템포 자동화(constant/progressive) 반영, 메트로놈/카운트인/루프/속도 3종 동작
- [ ] 드럼 트랙이 GM 매핑으로 재생

---

## Phase 7 — 이펙트 오디오 해석 + 믹서 + 자동화

- **🎯 목표**: 이펙트 심볼이 소리에 반영되고, 사운드보드(믹서)와 이펙트 체인이 동작.
- **📎 첨부**: `specs/04-오디오-엔진과-재생.md`, `specs/03-기보법-심볼과-이펙트.md`(§4.34)
- **⏱ 예상**: 2~3세션

### 💬 프롬프트

```
오디오 이펙트 해석 계층과 믹서를 구현하라.

1. 노트 이펙트 해석 (compile/scheduler 확장 — 명세서 03 §4.34의 "재생 반영" 목록 전부):
   - 벤드/와미: 커브 포인트(1/4음 단위) → source.detune의 setValueCurveAtTime 램프.
   - 비브라토: LFO(OscillatorNode) → detune 변조. slight/wide 진폭 2단계.
   - 슬라이드: 짧은 피치 램프(legato는 재어택 없음, shift는 재어택).
   - HoPo/레가토: 두 번째 노트 어택 감쇠(velocity 하향 + 어택 타임 늘림).
   - 팜뮤트: 로우패스 필터 + 짧은 디케이(트랙 intensity 슬라이더 반영). 데드노트: 매우 짧은 노이즈성 디케이.
   - 하모닉스: 피치 시프트(내추럴: 현 배음, 인공: +12/+19 등 타입별) + 사인성 톤.
   - 고스트/액센트/스타카토/다이내믹/헤어핀: velocity·duration 변환(헤어핀은 시작→목표 보간).
   - 렛링/서스테인 페달: release 억제(스트링 모드: 같은 현 새 노트가 이전 노트 차단 —
     track.interpretation.stringed 반영).
   - 페이드인/아웃/스웰: 게인 엔벨로프.
   - 트리플렛 필/페르마타는 이미 템포맵에서 처리 — 회귀 확인만.

2. 사운드보드 (글로벌 뷰 좌측 완성 — 명세서 04 §2):
   트랙 스트립 10요소: 아이콘/이름/가시성(눈)/Mute/Solo/볼륨 페이더/볼륨자동화 A배지/
   팬 노브/팬자동화 배지/EQ 버튼. 마스터 스트립 + Focus/Unfocus 바이폴라 노브
   (선택 트랙 강조: 다른 트랙 볼륨 감소 / 반대).
   게인 계산: trackGain × soloMuteMask × focusWeight × automationEnvelope.
   Solo/Mute 복수 선택 시맨틱스. 트랙 EQ: BiquadFilter 3밴드 + 악기별 프리셋.

3. 자동화 시스템 (명세서 02 §15):
   - 자동화 에디터(F10): 그래프 위 포인트 배치(비트/마디 스냅), 드래그 이동,
     Delete 삭제, transition 2종 선택, Remove Automations 버튼, 초기 템포 설정.
     LCD 템포 클릭·악보 템포 마커 클릭에서도 열림.
   - 레인 5종: tempo(마스터 전용)/track·master volume/track·master pan.
   - 재생 반영: constant → setValueAtTime, progressive → linearRampToValueAtTime.
   - 글로벌 뷰 A배지 토글(자동화 enable/disable).

4. 트랙 이펙트 체인 (명세서 04 §3.6, 간소화 버전):
   sound = { label, bank, chain: EffectSlot[최대 6] }, EffectSlot = { type, params, bypassed }.
   Web Audio로 구현할 이펙트 유닛 최소 세트:
   - Overdrive/Distortion (WaveShaper), Chorus/Flanger (DelayNode+LFO), Phaser (AllPass 체인),
     Delay (DelayNode+피드백), Reverb (ConvolverNode — 임펄스 몇 개 생성/포함),
     Wah (BiquadFilter 스윕 — 악보 wah open/close 심볼과 연동: 체인에 wah가 있을 때만 반영),
     Compressor (DynamicsCompressorNode), EQ (Biquad 스택), Volume 페달.
   - Track Inspector의 Sound 섹션: 사운드 추가/복제, 체인 슬롯 편집(추가/제거/재배열/bypass),
     사운드 체인지 자동화("A" 버튼 → 커서 위치에 사운드 전환 포인트).
   - 마스터링: 마스터 버스에 고정 3단 Comp/Limiter → Reverb → EQ (Song Inspector에서 편집).

5. 트랙 Interpretation 옵션 재생 반영: Auto brush(코드 미세 시차), Accentuation(박 자동 강세),
   Auto let ring, playing style별 벨로시티/톤 프로파일(간단 근사).

/debug/effects 페이지: 이펙트별 A/B(dry/wet) 청취 버튼 목록.
```

### ✅ 완료 기준
- [ ] 벤드/슬라이드/해머온/팜뮤트/하모닉스가 청취 가능하게 구별됨
- [ ] Solo/Mute/볼륨/팬/Focus 동작, 볼륨·팬 자동화가 재생에 반영
- [ ] F10 자동화 에디터에서 템포 커브 편집 → 재생 속도 변화
- [ ] 디스토션+딜레이+리버브 체인을 트랙에 걸고 소리 변화 확인

---

## Phase 8 — 트랙 시스템 심화

- **🎯 목표**: 트랙 생성 위저드, 튜닝/카포, 멀티보이스, 그랜드 스태프, 드럼 입력, 이조.
- **📎 첨부**: `specs/02-악보-데이터모델과-편집.md` (§4, §5, §8, §10, §16, §17, §18)
- **⏱ 예상**: 2~3세션

### 💬 프롬프트

```
트랙 시스템을 완성하라. 명세서 02의 해당 절을 정확히 따를 것.

1. 트랙 생성 위저드 (Ctrl+Shift+Ins / Add Track 버튼, 명세서 02 §4.1):
   단계: ①타입(Stringed/Orchestra/Drums/MIDI) → ②구체 악기 목록(더블클릭=즉시 생성)
   → ③이름/색/아이콘 → ④노테이션 타입(복수)+스태프(single/grand) → ⑤튜닝 → ⑥사운드(미리듣기)
   → Create. "Save instrument settings" 버튼(동일 악기 재선택 시 설정 재사용).
   새 문서 생성 시 트랙 0개면 이 위저드 자동 오픈.
   악기 프리셋 데이터(src/model/instruments.ts): 기타(6현 EADGBE)/7현/베이스(4·5현)/
   우쿨렐레/밴조/만돌린/피아노/드럼/스트링 등 20종 이상 — 각 {튜닝, 클레프, 음역, GM 프로그램}.

2. 튜닝 창 (명세서 02 §5): 악보 튜닝 텍스트 클릭 or Track Inspector에서 열림.
   - 라이브러리(악기별 프리셋) + 현별 커스텀(3~10현) + ♯/♭ 스펠링 선택.
   - 커스텀이 라이브러리와 일치하면 자동 인식 하이라이트. 미리듣기 재생 버튼.
   - capo + partial capo 동시 지원(절대 프렛, partial < capo면 경고). 프렛보드 그림 시각화.
   - Display label(악보 표시용 이름). 사용자 튜닝 프리셋 저장/편집/삭제
     (capo/partial/label은 프리셋에 저장하지 않음).
   - 커밋 모드 2택: "Keep the fingering"(프렛 유지, 피치 변경) vs
     "Adjust the fingering"(피치 유지, 핑거링 재계산 — 최적 현 배치 알고리즘).

3. 멀티보이스 (명세서 02 §8): Ctrl+1~4 보이스 전환, Ctrl+M 멀티보이스 편집 토글,
   Alt+1~4 노트를 보이스 n으로 이동. 비활성 보이스 회색+편집 불가.
   Tools > Move/Copy/Swap Voices 다이얼로그.

4. 그랜드 스태프: single↔grand 전환 시 마이그레이션 옵션
   (분할: Divide on C3 / 전부 1st / 전부 2nd; 병합: merge / 1st만 / 2nd만).
   Tab 키 = 좌수/우수 스태프 전환. 피아노 트랙 stringed off 시 운지 1~5 제안.

5. 드럼 트랙 (명세서 02 §17): 노트 = {midiNumber(27~87), articulation}.
   - 드럼 기보 매핑 테이블(스태프 라인↔MIDI, 명세서 §17.3 표 전체 포함).
   - 입력: 타브형 MIDI 번호 직접 타이핑 + 넘패드 1/2/3 아티큘레이션 순환
     (하이햇 open/semi/closed 등 — 커서 라인에 따라 후보 달라짐).
   - 가상 드럼킷 뷰(Ctrl+F6): 상단 Staff 뷰(요소 선택 시 넘패드 단축키 표시,
     호버 시 이름+MIDI 값) + 하단 GM 리스트(확장 팔레트, GM-only 필터).
     클릭=추가, 재클릭=삭제. 노트명 표시 3모드.

6. 이조 시스템 (명세서 02 §18): Track Inspector의 Transposition tonality 드롭다운,
   Song Inspector의 Concert tone 토글(활성 시 전 트랙 실음 표기),
   조표 다이얼로그의 콘서트/이조 기준 체크박스. writtenPitch 함수에 통합(이미 Phase 1 골격 있음).

7. 트랙 관리: 삭제(Del)/위아래 이동/전환(Ctrl+↑↓, LCD 팝업, 글로벌 뷰) 마무리.
   멀티트랙 뷰(F3): 전 트랙 동시 표시 + 글로벌 뷰 눈 아이콘으로 개별 가시성.
```

### ✅ 완료 기준
- [ ] 위저드로 기타+베이스+드럼 3트랙 밴드 스코어 생성 가능
- [ ] Drop D 튜닝 변경 시 keep/adjust 두 모드가 다르게 동작
- [ ] 드럼킷 뷰 클릭 + 넘패드 아티큘레이션으로 드럼 비트 입력
- [ ] F3 멀티트랙 뷰에서 전 트랙 표시
- [ ] Concert tone 토글 시 이조 악기 표기 변화

---

## Phase 9 — 도구 모음: 코드 · 스케일 · 튜너 · 악기 뷰 · 트랜스포즈

- **🎯 목표**: GP8의 연습/작곡 보조 도구. **모든 도구는 활성 트랙 튜닝에 자동 종속**(핵심 원칙).
- **📎 첨부**: `specs/06-도구와-부가기능.md` (§1~§7, §9)
- **⏱ 예상**: 2~3세션

### 💬 프롬프트

```
도구 모음을 구현하라. 공통 원칙: 모든 도구는 activeTrack.tuning(현 수+카포)을 구독하는
순수 계산 엔진 + UI로 분리한다.

1. 코드 다이어그램 (명세서 06 §1):
   - 코드 엔진(src/model/chords.ts): {root, quality, bass(전위)} → 구성음,
     보이싱 열거(현재 튜닝 기준) + 난이도 스코어 정렬(스트레치/바레/포지션),
     배치 노트→코드명 역인식, 바레 자동 제안.
   - 코드 창(A 단축키): 이름 빌더(루트+타입, 동등 코드명 목록) / 메인 다이어그램
     (프렛 클릭 토글, 우클릭 핑거링, 스크롤바로 루트 프렛, ○=개방 ×=뮤트,
     루트 하이라이트 옵션) / 보이싱 리스트(난이도순) / 오디션 재생 버튼(스트럼 시차).
   - 코드명: Classic/Jazz/Rock 3형식, 직접 수정 가능, 앞에 ' 붙이면 자동 리네임 방지.
   - 트랙 코드 라이브러리: beat는 chordId 참조(정규화). 헤더 다이어그램 편집 =
     전체 출현 반영. 이름만 있는 코드는 라이브러리에서 회색.
   - Show Diagram 자동 동작: 빈 비트에서 닫으면 다이어그램 노트가 악보에 입력,
     노트 있으면 표기만.

2. 스케일 도구 (명세서 06 §2):
   - 스케일 DB(src/model/scales.ts): {name, tags[], intervals[]} 정적 JSON.
     메이저/마이너 계열, 모드 7종, 펜타토닉, 블루스, 하모닉/멜로딕 마이너 계열,
     비밥, 대칭(디미니시, 홀톤), 민족 스케일 등 최소 200개(태그+키워드 검색 —
     매뉴얼은 1000+, 시작은 200으로 하고 확장 가능한 구조로).
   - Tools > Scales 창: 검색(태그 체크+키워드), 조성 선택, 인터벌/반음 구성 표시,
     오디션 재생, 프렛보드/키보드 오버레이 표시.
   - "Find scales from selection": 선택 구간 피치 클래스 히스토그램 vs DB 매칭 %,
     내림차순 목록.
   - 스케일 다이어그램(Shift+S, 명세서 06 §2.5): 현 3~10/프렛 3~24/시작 프렛/방향,
     요소별 심볼·색·텍스트(3자)·텍스트색, 클릭 추가/더블클릭 제거, 비트 위 표시.

3. 악기 뷰 3종 (Ctrl+F6 컨텍스트 토글 — 현악→프렛보드, 피치→키보드, 드럼→드럼킷):
   - 공통: 커서 비트 노트 표시, 클릭 입력/재클릭 삭제, 이전/다음 버튼, 기어 옵션,
     표시 스코프 3모드(Beat / Beat+Bar / Beat+NextBeat).
   - 프렛보드: 현 수·카포 자동 반영, 호버 미리보기(음이름+옥타브 E2 형식),
     좌손잡이 모드, 스케일 오버레이(루트=사각형), 우클릭=노트 추가+커서 전진.
   - 키보드: 트랙 음역 밖 건반 회색·클릭 불가.
   - (드럼킷 뷰는 Phase 8에서 완료 — 여기서는 공통 스코프 모드만 통합 확인.)

4. 튜너 (툴바 아이콘, 명세서 06 §5): getUserMedia + 자기상관 피치 검출.
   상단 모노포닉(단음 자동 감지) + 하단 폴리포닉(현별 바 — 시작은 모노 구현,
   폴리는 [선택] FFT 다중 피치로). 현재 트랙 튜닝이 목표값, 낮은 현→왼쪽 순,
   편차 바(빨강→정튜닝 시 초록).

5. 트랜스포지션 (Tools > Transpose, 명세서 06 §3):
   범위(선택/전체 마디) × 대상(현재/전체 트랙) 매트릭스 +
   3모드: Semitones(±n, 코드 다이어그램 포함 체크) /
   Chromatic(인터벌 unison~7th × minor/major/perfect/dim/aug × up/down + 옥타브,
   조표 이동은 전체 트랙+체크 시만) / Diatonic(조표 유지, 도수 평행 이동).
   코드 규칙: 빌더로 만든 다이어그램만 이조, 이름만 코드는 미적용,
   이조 불가 다이어그램은 삭제+이름 유지.

6. 정리 위저드 (Tools 메뉴, 명세서 06 §9 — 전부 선택 범위→순수 변환→1 undo):
   Let Ring Options(현별 일괄) / Palm Mute Options(현별 일괄) / Bar Arranger /
   Complete/Reduce Bars with Rests / Automatic Finger Positioning(피치 불변 운지 최적화) /
   Check Bar Duration(F4 — 전체 스캔 보고서).
```

### ✅ 완료 기준
- [ ] A키 코드 창에서 C, Am7, F#m7b5 등 생성 → 다이어그램+보이싱 리스트 확인
- [ ] 스케일 오버레이를 프렛보드에 띄우고 우클릭 연속 입력
- [ ] 튜너가 기타 소리(또는 사인파 테스트)에 반응
- [ ] 반음/크로매틱/다이어토닉 이조가 각각 다르게 동작
- [ ] F4 마디 검사 보고서

---

## Phase 10 — 커맨드 레지스트리 완성 + 커맨드 팔레트 + 전체 단축키

- **🎯 목표**: Ctrl+E 커맨드 팔레트(GP8의 킬러 기능)와 전체 단축키 맵 완성.
- **📎 첨부**: `specs/06-도구와-부가기능.md` (§8, §10 — 전체 단축키 표), `specs/01-UI-구조와-내비게이션.md`(§9)
- **⏱ 예상**: 2세션

### 💬 프롬프트

```
커맨드 시스템을 완성하라.

1. 전체 단축키 맵 (명세서 06 §10의 표 전체를 src/commands/keymap.ts에 데이터로):
   - 파일/편집/선택/마디/트랙/보이스/커서/노트입력/이펙트/재생/뷰 카테고리 전부.
   - 플랫폼 매핑(Ctrl↔⌘ 불일치 다수: Redo Ctrl+Y vs ⇧⌘Z 등) — navigator.platform 기준.
   - 포커스 스코프: global / workspace / dialog별 활성 규칙(핑거링 창 자체 단축키 등).
   - Shift 조합 문자키('%', '[', '<' 등)는 event.key 매칭. 단축키 커스터마이즈는 없음
     (+/- 반전 preference 1건만). 모든 툴팁/메뉴에 단축키 자동 병기.
   - 브라우저 예약키 정책: Ctrl+N/W/T는 앱 내 대체(문서에 배너로 안내) 또는 PWA 모드에서만.

2. 커맨드 팔레트 (Ctrl+E — 명세서 06 §8 그대로):
   - 위치: 탭바 바로 아래 검색 필드. 플레이스홀더:
     "Type ? to show the commands list; up or down to browse the command history"
   - 입력 문법: 일반 텍스트=증분 검색 / ? = 명령 목록 / @ = Action List /
     > = Expression Text / $ = Go to section / : = Go to bar / unset <Effect> = 이펙트 제거.
   - 제안 목록: 알파벳순 2열(prefix | 설명), 컨텍스트 불가 명령은 회색,
     Tab=자동완성/옵션 패널 확장(↹ 아이콘), Enter=적용, ↑↓=탐색+히스토리,
     이탤릭 플레이스홀더(bar-count 등), 파란 바 아래 사용법 표시.
   - Quick commands 32개(명세서 §8.3 목록 그대로 등록 — 기존 커맨드에 prefix 별칭 부여).
   - Advanced commands(§8.4 표): add-bar N, x(repeat bars), 4/4(박자 직접),
     n:m(커스텀 튜플렛), bend 2, clef(현재 값 표시), dynamic, key-signature,
     select-bars, view, zoom, voice, transpose, tempo/volume/pan 등 — 옵션 위저드 패널 체인.
   - 패턴 커맨드 9종(§8.5): pickstroke dduddud / arpeggio / brush / golpe /
     left hand(01234T,-,Space) / right hand(pimac) / picking(Alternate|Economy) /
     slap pop / wah(o,c). ★ 키 입력마다 라이브 미리보기(비트 즉시 편집), Enter 커밋/Esc 롤백
     — 편집 트랜잭션 프리뷰 구조로 구현.
   - flow 모드(적용 후에도 팔레트 유지), 토글 재적용 시 제거 확인 프롬프트.
   - Expression Text(>): Chords/Dynamics/Key signatures/Octave signs/Clefs/Directions를
     이름으로 직접 적용(>Cm). Action List(@): 메뉴 트리 12개 전체를 탐색/실행(부분 문자열 필터).

3. 메뉴바 최종 동기화: 12개 메뉴의 모든 항목이 레지스트리 기반으로 생성되는지,
   Action List와 메뉴가 같은 트리를 쓰는지 검증하는 테스트를 작성하라.
```

### ✅ 완료 기준
- [ ] Ctrl+E → `add-bar 20`, `4/4`, `>Cm`, `pickstroke dduddud`(라이브 프리뷰), `unset Tie` 동작
- [ ] `@`로 메뉴 트리 탐색·실행, `$`/`:`로 섹션/마디 점프
- [ ] 명세서 §10 표의 단축키가 스포트체크 20개 이상 통과

---

## Phase 11 — 스타일시트 + 표시 모드 + 디자인 모드

- **🎯 목표**: 문서별 렌더링 커스터마이징(F7)과 6종 표시 모드, 수동 레이아웃.
- **📎 첨부**: `specs/03-기보법-심볼과-이펙트.md` (§8), `specs/01-UI-구조와-내비게이션.md` (§4~§6)
- **⏱ 예상**: 2세션

### 💬 프롬프트

```
렌더링 커스터마이징 계층을 구현하라.

1. 스타일시트 (F7 — 명세서 03 §8): 문서에 직렬화되는 단일 JSON 설정 객체(60+ 키).
   렌더러의 metrics/옵션이 전부 이 객체를 읽도록 리팩터. 5탭 다이얼로그:
   - Page & Score Format: 용지 12종+커스텀/방향/여백, 비율(Rhythm proportion 소수점),
     튜닝 표시(위치/모드 3종/2열/가로/프레임), 코드 다이어그램(스타일 3종/배치 3종/크기·간격).
   - Systems & Staves: 오선 굵기, 시스템 간격, 토글 8종(첫 시스템 들여쓰기,
     슬래시 오선/바라인, 확장 바라인, 클레프/박자표 반복, 섹션 박자표,
     Capo·변칙튜닝의 표준기보 영향), 브래킷 3택, 트랙명(빈도 4택/형식/방향).
   - Header & Footer: %TITLE% 등 토큰 9종 + 자유 텍스트, 항목별 폰트/크기/정렬,
     첫 페이지/나머지 페이지 별도 구성.
   - Texts & Styles: 요소별 폰트/크기/스타일, 템포 소수점 표시, 가사 위치 3택,
     마디 번호 3택, 심볼 스타일 Classic/Jazz, 심볼 문구 리네임 10종,
     "Extend symbol lines over rests" 토글.
   - Notation: 타브 리듬 토글 6종 + 보이스별 리듬 위치(4보이스 × above/below/hidden),
     심볼 세부 토글 19종(명세서 §8.5.2 표 그대로), 운지 표기(좌 2택/우 4택/위치/크기).
   - Options 탭: Save style(이름 저장/재사용), 내장 프리셋 Rock/Jazz/Classic 로드.
   변경 즉시 리플로우(OK 버튼 없음 — GP8 라이브 적용 원칙).

2. 표시 모드 6종 (View 메뉴+툴바, 명세서 01 §4): Vertical/Horizontal Page, Grid,
   Parchment(페이지 브레이크 제거 연속), Vertical/Horizontal Screen(컨테이너 리플로우).
   레이아웃 전략 패턴으로 구현, ResizeObserver 재레이아웃. 줌(Ctrl+±, 25~300%,
   문서 저장 + Preferences Force 오버라이드).

3. 디자인 모드 (Ctrl+Alt+D, 명세서 02 §6.7): 룰러 위 삼각형 드래그로 마디 폭 조절
   (수정된 삼각형 빨간색), 시스템당 마디 추가/제거(+/-), 시스템 간격 리셋(X),
   Bar > System layout 다이얼로그(줄당 마디 수, Start at current system).
   줄바꿈은 활성 트랙/멀티트랙 뷰별 독립 저장.
```

### ✅ 완료 기준
- [ ] F7에서 용지/여백/헤더 토큰 변경 → 즉시 리플로우
- [ ] Rock/Jazz/Classic 프리셋 전환 시 심볼 스타일 변화
- [ ] 6종 표시 모드 전환 + 줌
- [ ] 디자인 모드에서 마디 폭 수동 조정

---

## Phase 12 — 파일 임포트/익스포트

- **🎯 목표**: 저장/열기(네이티브), MusicXML/MIDI/ASCII 임포트·익스포트, PDF/PNG/SVG/오디오 익스포트, 인쇄.
- **📎 첨부**: `specs/05-파일-임포트-익스포트.md`
- **⏱ 예상**: 3세션 (12a: 네이티브+열기/저장 / 12b: 교환 포맷 / 12c: 렌더·오디오 익스포트)

### 💬 프롬프트 12a — 네이티브 포맷과 파일 UX

```
파일 시스템 계층을 구현하라 (명세서 05).

1. 네이티브 포맷 .gpw: ZIP 컨테이너(JSZip) — score.json(버전 필드 포함) +
   stylesheet.json + documentSettings.json + (선택) 임베드 오디오 바이너리.
   스키마 버전 마이그레이션 훅. 저장 시 documentSettings(줌/표시모드/엔진)도 포함
   (GP8은 문서에 표시 설정을 저장 — 명세서 05 §7).
2. 열기/저장 UX: File System Access API(showOpenFilePicker/showSaveFilePicker,
   폴백: <input type=file>+다운로드). Ctrl+O/S/Shift+S.
   전역 드래그&드롭 존(앱 어디에나 파일 드롭=열기).
   최근 파일 목록(IndexedDB에 파일 핸들 영속) + beforeunload dirty 경고.
   세션 복원 옵션(Open last session documents — IndexedDB 자동 스냅숏).
3. 파일 보호 3종(명세서 05 §5): Finalize(무비밀번호 잠금) / Lock editing(비밀번호,
   PBKDF2 해시) / Lock opening(AES-GCM 콘텐츠 암호화, 비밀번호 유도 키).
   탭바 자물쇠 아이콘 + 클릭 해제 플로우. 편집 잠금 시 에디터 읽기 전용 게이트.
```

### 💬 프롬프트 12b — 교환 포맷

```
교환 포맷 임포터/익스포터를 구현하라 (명세서 05 §2~§3).

1. MusicXML: 임포트(표준+압축 .mxl) / 익스포트. 파트→트랙, 타브 string/fret 속성,
   반복/볼타/디렉션, 튜플렛, 타이, 다이내믹 매핑. 왕복(round-trip) 테스트 필수.
2. MIDI 임포트 (format 0/1) — GP8의 5영역 다이얼로그 재현:
   ①대상(새 파일/현재 파일 뒤에 추가) ②트랙 매핑 테이블(체크박스, 대상 트랙 병합,
   Program change→악기, 없으면 piano 폴백, 그랜드 스태프 감지) ③전역 파라미터
   (Quantization 최소 음가, Increase note value, 점음표 변환, Authorize multivoice,
   Authorize triplets, 2ch/track) ④스코어 옵션(박자/조표/템포 임포트 — 미체크 시
   4/4·C major·120bpm) ⑤실시간 미리보기(파라미터 변경 시 자동 갱신 — 파싱→양자화
   파이프라인을 순수 함수로 유지해 미리보기 캔버스 재렌더).
3. MIDI 익스포트 (format 1 .mid): 언롤링 후 직렬화. 글로벌 뷰 mute = 트랙 제외 필터.
   트랙당 2채널(이펙트 노트 분리) 기본 + 1채널 호환 옵션, 퍼커션 ch10, 벤드=피치벤드 이벤트.
4. ASCII 탭: 익스포트(활성 트랙, 22종 이펙트 기호 범례 — 명세서 05 §3.2 표 그대로,
   고정폭 컬럼 정렬, 마디 |) / 임포트(파싱 규칙 4종: 하이픈 현 라인, | 마디,
   빈 줄 금지, 인라인 주석 금지 — 활성 트랙 위로, 임포트 후 F4 검사 안내 토스트).
```

### 💬 프롬프트 12c — 렌더/오디오 익스포트와 인쇄

```
익스포트를 완성하라 (명세서 05 §3~§4).

1. 공통 익스포트 다이얼로그 모듈: 파일명 토큰 시스템(%T 제목/%t 트랙명/%n 트랙번호/
   %N 총트랙/%d 날짜/%h 시각) + 라이브 파일명 미리보기 + 페이지/선택 범위.
2. PDF: 현재 뷰 모드+스타일시트 레이아웃 그대로 벡터 출력(SVG 씬 그래프 → pdf-lib 또는
   svg2pdf). 해상도/페이지 범위/선택 영역 옵션.
3. PNG(WYSIWYG, 해상도 스케일, 투명 배경 옵션 — SVG→canvas.toBlob) / SVG(씬 그래프
   직렬화 — 사실상 무비용, 페이지당 1파일, 투명 배경).
4. 오디오 익스포트: OfflineAudioContext 렌더 → WAV(자체 인코더) + MP3/OGG/FLAC(WASM
   인코더 — lamejs 등, 번들 크기 보고). 옵션: 선택 구간만/트랙별 스템(ZIP)/메트로놈 포함/
   카운트인 포함.
5. 인쇄(Ctrl+P): Page 모드 렌더 → print CSS(@page, 스타일시트 용지 설정 반영) →
   window.print(). 툴바 인쇄 버튼(넓을 때만 표시 — 반응형 규칙 재확인).
```

### ✅ 완료 기준
- [ ] 저장→새로고침→열기 라운드트립 무손실
- [ ] MusicXML 왕복 테스트 통과, MIDI 임포트 다이얼로그+미리보기 동작
- [ ] PDF/PNG/SVG 익스포트 결과가 화면과 동일
- [ ] MP3/WAV 익스포트 청취 확인, 스템 ZIP
- [ ] 잠금 파일 열기/해제 플로우

---

## Phase 13 — 홈페이지 · 환경설정 · 오디오 트랙 · 마무리

- **🎯 목표**: 제품 수준 마무리 — 런처 홈페이지, 환경설정 5탭, 오디오 백킹 트랙, 성능/QA.
- **📎 첨부**: `specs/01-UI-구조와-내비게이션.md` (§1, §10), `specs/04-오디오-엔진과-재생.md` (§6~§8)
- **⏱ 예상**: 2~3세션

### 💬 프롬프트

```
마무리 기능들을 구현하라.

1. 홈페이지 (명세서 01 §1): 앱 시작 화면 + 툴바 홈 아이콘으로 재진입(열린 문서 유지 —
   오버레이/탭 방식). New File/Open File 버튼, 실시간 통합 검색(카테고리별 카운트 배지),
   카테고리: Recent files(핀 고정 — 호버 시 핀 아이콘, 최상단 고정)/Local files
   (showDirectoryPicker로 폴더 인덱싱)/Templates(기본+사용자 저장)/Examples(데모 파일 번들).
   파일 카드: 악보 미리보기 썸네일 + 트랙별 프리리스닝 재생 버튼.
   [선택] mySongBook 섹션은 스코프 제외 — 자리만 두고 숨김 처리.

2. 환경설정 (Ctrl+, — 5탭, 모든 설정 즉시 적용/OK 버튼 없음, 명세서 01 §10):
   - General: Default template, Force options(줌/스타일시트/MIDI 재생 강제 오버라이드),
     Open last session documents, Embed audio by default.
   - Interface: 재생 커서 스타일 4종, 재생 마디 연노랑 하이라이트, +/- 키 반전,
     복붙에 다이어그램 포함, 언어(en/ko — 리로드 적용).
   - Score errors: 오류 검사 항목별 토글(불완전 마디 등) → 검증기 설정 연동.
   - User information: 기본 작성자/저작권 → 새 문서 곡 정보 프리필.
   - Audio/MIDI: 출력 장치 선택(setSinkId)+테스트 사운드, 입력 장치+VU 미터,
     버퍼/레이턴시 힌트, MIDI 출력 포트 4슬롯+Test, MIDI 입력+캡처 감도(ms)+현 할당 모드.

3. 오디오 트랙 (명세서 04 §8 — 백킹 오디오와 악보 동기화):
   - 파일당 1개, 임포트 6포맷(decodeAudioData), 툴바 버튼(존재 시 파란 테두리),
     워크스페이스 아래 웨이브폼 창(자체 줌).
   - 그리드 오버레이: 마디 블록(첫 박 빨간 실선, 나머지 박 노란 점선, 박자표 적응).
   - [ ] 브래킷 재생 구간, Ctrl+드래그 패딩, 비트 더블클릭 싱크 포인트 토글,
     포인트 드래그 = 구간 템포 자동 계산(다음 포인트까지 유지).
   - 오디오 트랙 활성 시: 싱크 포인트가 템포를 구동(악보 템포 자동화 무시),
     반복/디렉션 미적용(선형 언폴드 재생), Fixed BPM 비활성.
   - 양방향 변환: 싱크 포인트 ↔ 악보 템포 자동화. 세미톤+센트 시프트([선택] 타임스트레치
     워크릿 — 초기엔 playbackRate+detune 근사 허용). 글로벌 뷰에 Audio Track 스트립
     (볼륨/팬/EQ/솔로/뮤트). 임베드 저장/MP3 추출.

4. MIDI 스텝 입력(Sound > MIDI Capture): Web MIDI 입력 → 감도(ms) 윈도로 코드 그루핑,
   한 비트씩 입력, 채널→현 할당 2모드.

5. 마무리 QA 패스:
   - 성능: 100마디×8트랙 스코어에서 편집 레이턴시 <50ms, 재생 글리치 없음
     (레이아웃 증분 캐시: 변경 마디의 시스템만 재계산).
   - 뷰포트 가상화(보이는 페이지/시스템만 SVG 마운트), 웹워커로 레이아웃 오프로드 [선택].
   - 키보드 접근성/포커스 트랩(다이얼로그), 에러 바운더리, 자동 저장(IndexedDB 5분).
   - Playwright 스모크 스위트: 생성→입력→재생→저장→열기 전체 시나리오.
```

### ✅ 완료 기준
- [ ] 홈페이지에서 검색/최근 파일 핀/템플릿 시작
- [ ] 환경설정 변경이 즉시 반영 (커서 스타일, +/- 반전 등)
- [ ] MP3 백킹 트랙 로드 → 싱크 포인트 2개로 악보 동기화 재생
- [ ] 100마디×8트랙 성능 기준 충족

---

## 부록 A — 매뉴얼 기반 핵심 수치 카드 (AI에게 자주 상기시킬 것)

| 항목 | 값 |
|---|---|
| 내부 시간 해상도 | **480 ticks = 4분음표** |
| 보이스 | 트랙당 **4** (색: yellow/green/pink/purple) |
| 현 수 / 프렛 | **3~10현**, 카포+파셜 카포(절대 프렛) |
| 음가 | whole~64th **7단계**, 점 +1/2, 겹점 +3/4 |
| 튜플렛 | **2~13** + n:m 커스텀 + **중첩** |
| 임시표 | 5종, 효력 = **마디 끝까지** |
| 다이내믹 | **8단계** ppp~fff |
| 벤드 | 1/4음 해상도, 최대 **3음**, Full=온음, 패밀리 **7종** |
| 템포 | 소수점 허용, 30bpm 미만 허용, 자동화=마스터 전용 |
| 속도 도구 | 상대 10~300%(프리셋 7), 고정 10~300bpm, 재생 중 ±5%/5bpm |
| 반복 | 패스 표시(2회면 숨김), 볼타 패스 **1~8**, 중첩 지원 |
| 이펙트 체인 | 트랙 **6슬롯**, 마스터링 **3단 고정**(Comp→Reverb→EQ) |
| 드럼 | MIDI **27~87**, 채널 10 고정, 넘패드 1/2/3 아티큘레이션 |
| 가사 | 트랙당 **5줄**, 첫 스태프에만 |
| 그레이스 노트 | **현당 1개**, 마디 duration 제외 |
| 표시 모드 | **6종**, 최소 뷰포트 1024×768 |
| 곡 정보 | **10필드**, 헤더 토큰 %TITLE% 등 9종 |
| 파일명 토큰 | %T %t %n %N %d %h |
| 퀵 커맨드 | 정확히 **32개** / 패턴 커맨드 **9종** |
| 표기 전용(비재생) 심볼 | Pickscrape, Dead slapped, (체인에 페달 없는) Wah, 운지, 현번호, 바레 |

## 부록 B — 자주 쓰는 보조 프롬프트

**렌더링 품질 개선 루프**:
```
/debug/symbols 페이지를 열고 Guitar Pro 8 실제 스크린샷(첨부)과 비교해서
시각적으로 어긋난 부분을 목록화한 뒤, 우선순위 상위 3개만 고쳐라.
한 번에 다 고치지 말고 하나 고칠 때마다 스냅숏 테스트를 갱신하라.
```

**버그 수정**:
```
[증상 서술]. 먼저 재현 테스트를 작성해 실패를 확인하고, 원인을 분석 보고한 뒤 고쳐라.
명세서(specs/0X-....md)의 §N 동작과 다른 부분이 있으면 명세서가 정답이다.
```

**Phase 중간 이어하기**:
```
직전 세션에서 Phase N을 진행 중이었다. git log와 코드를 훑어 현재 상태를 파악하고,
Phase N 프롬프트의 완료 기준 중 미달 항목을 찾아 이어서 작업하라.
```

**성능 점검**:
```
100마디 × 8트랙 스코어를 생성하는 시드 스크립트를 만들어 로드한 뒤,
편집(노트 입력)과 재생 시작의 소요 시간을 측정해 보고하라. 50ms를 넘는 경로가 있으면
프로파일 결과와 함께 개선안을 제시하라(레이아웃 증분 캐시/가상화 우선).
```

## 부록 C — 스코프 제외/축소 권장 목록 (원본에 있으나 웹 클론에서 후순위)

| 기능 | 이유 / 대체 |
|---|---|
| mySongBook 스토어 | 상용 카탈로그 — UI 자리만. 자체 라이브러리 서버는 별도 프로젝트 |
| Fretlight 연동 | 하드웨어 의존(WebHID/BT로 가능은 함) — 스코프 제외 |
| Line-in 실시간 이펙트 | getUserMedia 레이턴시 한계 — [선택] 실험 기능 |
| .gp/.gp5/.gpx 바이너리 파싱 | 리버스 엔지니어링 규모 큼 — 부록 D의 alphaTab 경로로 대체 |
| 배치 컨버터 | 네이티브 파싱 확보 후에만 의미 |
| PowerTab/TablEdit 임포트 | 희귀 바이너리 포맷 — 제외 |
| 시그니처 사운드 260종 | 라이선스 자산 — 자체 프리셋 20~30종으로 대체 |
| 폴리포닉 튜너 | 모노포닉 먼저, 폴리는 실험 |

## 부록 D — alphaTab 하이브리드 경로 (빠른 결과가 필요할 때)

자체 엔진 대신 [alphaTab](https://alphatab.net)(MPL-2.0)을 코어로 쓰면 Phase 2(렌더링)·6(재생)·12(.gp 임포트)를 크게 단축할 수 있습니다. 단, **편집 기능이 없으므로** 편집 커널은 어차피 직접 만들어야 하며, alphaTab 데이터 모델에 종속됩니다.

**부트스트랩 프롬프트**:
```
@coderline/alphatab 패키지로 Guitar Pro 클론의 코어를 부트스트랩하라.
1. .gp/.gp5/.gpx 파일을 열어 렌더링+재생(내장 신스)까지 동작시켜라.
2. alphaTab의 Score 데이터 모델을 조사해 보고하라: 우리가 편집 기능을 얹으려면
   어떤 API로 모델을 수정하고 리렌더를 트리거해야 하는가?
3. 이 문서의 Phase 3(편집 커널)을 alphaTab 모델 위에 구현하는 계획을 제시하라.
판단 기준: 6개월 내 결과물이 목표면 이 경로, 완전한 제어와 학습이 목표면 자체 엔진 경로.
```

---

## 진행 체크리스트

- [ ] Phase 0 — 부트스트랩
- [ ] Phase 1 — 데이터 모델 & 검증기
- [ ] Phase 2 — 렌더링 엔진 (2a 레이아웃 / 2b 리듬 표기)
- [ ] Phase 3 — 편집 커널
- [ ] Phase 4 — UI 셸
- [ ] Phase 5 — 심볼 & 이펙트 (5a 마디 / 5b 노트·이펙트)
- [ ] Phase 6 — 재생 엔진 (6a 언롤러 / 6b 신스·스케줄러)
- [ ] Phase 7 — 이펙트 오디오 + 믹서 + 자동화
- [ ] Phase 8 — 트랙 시스템 심화
- [ ] Phase 9 — 도구 모음
- [ ] Phase 10 — 커맨드 팔레트 + 단축키
- [ ] Phase 11 — 스타일시트 + 표시 모드
- [ ] Phase 12 — 파일 I/O (12a 네이티브 / 12b 교환 포맷 / 12c 익스포트)
- [ ] Phase 13 — 홈페이지 + 환경설정 + 오디오 트랙 + QA

*이 문서와 specs/ 명세서 6종은 Guitar Pro 8 공식 사용자 매뉴얼(334p) 전체 분석에 기반합니다.*
