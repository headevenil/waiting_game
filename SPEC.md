# Build spec: Korean queue games in HTML, CSS and JS

Oct 1, 2026 · @Nicholas Chung

## Locked decisions

Version 1 is a Korean-language, offline-first web app in plain HTML, CSS and JavaScript (ES modules, no framework, no build step) with six pass-the-phone games, deployed as static files on Cloudflare.

| Decision | Choice | Reason |
| --- | --- | --- |
| Stack | Vanilla HTML + CSS + JS ES modules; zero runtime dependencies | Nothing to install or break; any AI assistant writes it fluently; you can read every line |
| Build step | None for the app. One optional Python script subsets the display font when content changes | Deploy = upload the folder. Python matches your existing toolset |
| Language | Korean UI and content (`lang="ko"`); English only in code identifiers and comments | The whole group plays in Korean |
| Tone | Friendly 해요체 for instructions, playful 반말 for reactions ("정답!", "아깝다!") | Reads like a variety-show host, not a manual |
| Games in v1 | 라이어 찾기, 마음 다이얼, 1부터 10까지, 사라지는 힌트, 숨은 조력자 스무고개, 겹치면 꽝 | The six you chose; Most Likely To is dropped |
| Mode | Pass mode only (one phone). Engines written as pure reducers so Room mode can be added later | Works with zero signal |
| Players | Tuned for 5; code accepts 4–6 so one absent friend doesn't block play | Insider- and Just One-style games need at least 4 |
| Targets | iOS Safari 17+ and current Android Chrome, installed to the home screen; wake lock from iOS 18.4 | Covers everyone's phone in a Korean group |
| Hosting | Cloudflare Workers static assets (free), unlisted (`noindex`) | $0, global, git-push deploys |
| Size budget | App code + CSS + content under 400 KB; subset display font under 250 KB | Fast first load on weak park signal |
| Data | Everything in `localStorage`; no accounts, no analytics, no network calls during play | Privacy and offline by default |

Non-negotiable behaviours, tested before every trip:

- Opens and plays in airplane mode after one prior visit.
- Reopening at any moment lands on a safe screen with no secret visible.
- Every secret is shown only while a finger is held down.
- Nothing is lost when the phone locks, the app is killed, or a call comes in.

## Korean localization

Korean-izing works on three layers: every word of copy, the culture of the games and content, and the engineering details that English apps never hit (particles, Hangul input, normalization, fonts).

### Game names

| Working title | Korean name | Inspired by | Why this name |
| --- | --- | --- | --- |
| Odd One Out | **라이어 찾기** | The Chameleon / Korean "라이어 게임" | Korean groups already know the liar game from variety shows such as 신서유기 ([example](https://yccollege.website/Story/?bmode=view&idx=4650457)). "찾기" avoids clashing with the tvN drama title 라이어 게임 |
| On the Dial | **마음 다이얼** | Wavelength | "Tuning into each other's mind" says the goal in two words |
| Scale of 10 | **1부터 10까지** | Top Ten | The rule is the name; instantly understood |
| Fading Clues | **사라지는 힌트** | Eraser | Describes what players see happen on screen |
| Insider | **숨은 조력자 스무고개** | Insider | 스무고개 is the traditional Korean 20 Questions; avoids "인사이더", also a 2022 JTBC drama |
| Just One | **겹치면 꽝** | Just One | Sold in Korea as 저스트 원 by Korea Boardgames ([listing](https://www.koreaboardgames.com/product/detail?prdCd=PD2024002153LFWY)); our name is the rule itself: overlap and it's a dud |

### Voice and copy

- Instructions in 해요체: "폰을 민지에게 넘겨주세요."
- Reactions in short 반말, variety-caption style: "정답!", "아깝다\~", "라이어 검거!", "꽝!"
- Address players with the vocative: "민지야, 꾹 눌러서 확인해!" / "준혁아, 네 차례야!"
- Every rules card is exactly 3 lines, each under 20 characters where possible.
- Below it, a 누구 편? card (each game's `sides`) says who plays with whom and for what, so hidden-role players know which side to play for. 라이어 찾기 and 스무고개 also show the player's side on their secret screen.
- Button labels are verbs that say what happens: 확인했어요, 다음 사람, 투표하기, 정답 공개.

### Particle (조사) helper

Names change the particle that follows them (민지**가** / 준혁**이가**, 민지**를** / 준혁**을**). All copy goes through one helper; strings are never hand-concatenated.

```js
// i18n/josa.js
export function josa(word, pair) { // '이/가' '을/를' '은/는' '과/와' '아/야' '으로/로'
  const last = word.trim().at(-1) ?? '';
  const code = last.charCodeAt(0) - 0xac00;
  const [withFinal, noFinal] = pair.split('/');
  if (code < 0 || code > 11171) return word + '(' + withFinal + ')' + noFinal; // non-Hangul name
  const final = code % 28;                       // 0 = no final consonant (받침)
  if (pair === '으로/로' && (final === 0 || final === 8)) return word + '로'; // ㄹ takes 로
  return word + (final ? withFinal : noFinal);
}
// josa('민지','아/야') → '민지야'   josa('준혁','아/야') → '준혁아'
```

Strings live in `i18n/ko.js` as small functions that take player names and call `josa()` wherever a particle follows a name.

### Hangul input (IME)

Korean keyboards compose syllables (ㅎ → 하 → 한), so naive "submit on Enter" breaks.

- Primary submit is always a big on-screen **확인** button, not the keyboard Enter.
- If Enter is handled, ignore it while composing: `e.isComposing || e.keyCode === 229` means "still composing, do nothing".
- Read the final value after `compositionend` (or on button tap), never from mid-composition `input` events.
- Inputs use `lang="ko" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"`. This also stops the keyboard's suggestion bar from showing the previous player's secret clue.
- Clear and blur the input before the pass gate, so the next player never sees the last typed word.

### Comparing Korean words

Used by 겹치면 꽝 (duplicate clues), 사라지는 힌트 and 스무고개 (guess checking).

```js
export const norm = (s) => s.normalize('NFC').toLowerCase()
  .replace(/[\s\p{P}\p{S}]/gu, '');           // drop spaces, punctuation, emoji
```

- Exact match after `norm()` is automatic. Each content word may also list `aliases` ("떡볶이": \["떡뽁이"\]).
- Particles are **not** auto-stripped: 고양이 ends in 이, so stripping would corrupt real words.
- A human always has the final say: a "같은 말이에요" tap merges near-duplicates, and "정답 인정" overrides a strict mismatch.

### Fonts and typography

- **Display: 도현체 (Do Hyeon)** by Woowa Brothers, inspired by old Korean shop signs cut from acrylic, under the SIL Open Font License ([1001 Fonts](https://www.1001fonts.com/bm-dohyeon-font.html)). It has about 3,093 glyphs ([FontMeme](https://fontmeme.com/fonts/do-hyeon-font/)): enough for the 2,350 common syllables, not all 11,172. Content therefore gets a coverage check, and rare syllables fall back to the body font.
- **Body: system Korean fonts**, zero download: `"Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", "Malgun Gothic", system-ui, sans-serif`.
- `word-break: keep-all` so Korean wraps between words, not mid-word; `overflow-wrap: anywhere` as a safety net.
- `letter-spacing: -0.01em` on body text, `font-variant-numeric: tabular-nums` on scores and timers.

## Universal round flow

All six games are the same loop with different middles: secrets go out one player at a time through the pass gate, then the group plays out loud on one shared screen.

&#91;embedded content: universal round flow · shared by all six games\]

Games differ only in what happens inside 대화·행동 and 판정: 라이어 찾기 and 스무고개 vote, 겹치면 꽝 and 사라지는 힌트 judge a guess, 1부터 10까지 sorts, 마음 다이얼 locks a needle. In 사라지는 힌트 the pass-and-peek loop also carries the guess and the erase.

## Game 1 · 라이어 찾기 (Odd One Out)

Four 시민 know the secret word, one 라이어 knows only the topic; one spoken sentence each, a vote, and a last-chance guess for the liar. About 3–5 minutes.

**Rules card (shown on the start screen):**

> 라이어만 제시어를 몰라요.
>
> 한 명씩 돌아가며 제시어를 한 문장으로 설명해요.
>
> 라이어를 찾으면 시민 승! 라이어가 제시어를 맞히면 역전!

**Roles at 5:** 시민 ×4 see 주제 + 제시어. 라이어 ×1 sees 주제 + "당신은 라이어예요".

**Phases (`state.phase`):**

1. `setup`: choose 주제 (or 랜덤) and mode (일반 / 바보). App draws the word, the liar and a speaking order. The liar is never first to speak.
2. `reveal`: pass-gate loop over all 5 players; hold to see role and word.
3. `describe`: shows the speaking order with the current speaker in a big caption. "한 바퀴 더" adds a second round. Optional soft timer, 3 minutes.
4. `vote`: "하나, 둘, 셋!" countdown, everyone points at once, then the host taps the accused. A tie triggers a revote between the tied players; a second tie means the liar escapes.
5. `lastChance`: only if the liar was caught. The liar says (or types) a guess; the group taps 맞음 / 틀림.
6. `result`: full-screen caption ("라이어 검거!", "라이어 승리!", "역전승!"), word and liar revealed, scores added.

**Scoring** (point values follow common Korean liar-game apps, e.g. [alwayscorp](https://alwayscorp.co.kr/games/liar-game)):

| Outcome | Points |
| --- | --- |
| Liar caught and guesses wrong | Each 시민 +1 |
| Liar caught but guesses the word | Liar +2 |
| Liar not caught (wrong accusation or double tie) | Liar +3 |

**Options and edge cases:**

- **바보 모드**: the liar receives a similar decoy word (사과 → 배) and doesn't know they're the liar, a popular variant in Korean apps ([new order wiki](https://wiki.neworder.xyz/wiki/%EB%9D%BC%EC%9D%B4%EC%96%B4_%EA%B2%8C%EC%9E%84)). Needs a `decoy` field on words.
- **Forgot the word?** "다시 보기" lets any player re-peek through the pass gate; everyone sees the same button, so asking reveals nothing.
- The liar's screen shows the 주제 in the same layout and size as the 시민 screen, so a glance from a neighbour can't tell them apart.

**Content used:** `words` with `category` and optional `decoy`; about 12 topics × 40 words.

## Game 2 · 마음 다이얼 (On the Dial)

One 출제자 secretly sees where a target sits between two opposite words, says one clue, and the other four argue the needle into place. Cooperative, about 2–3 minutes per round, five rounds so everyone sets once.

**Rules card:**

> 출제자만 과녁 위치를 봐요.
>
> 양 끝 단어 사이, 과녁 자리에 맞는 힌트를 말해요.
>
> 다 같이 상의해서 바늘을 돌려요. 가까울수록 높은 점수!

**Roles at 5:** 출제자 ×1 (rotates each round), 맞히는 팀 ×4.

**Phases:**

1. `setup`: draw a spectrum pair ("덜 매운 ↔ 아주 매운") and a random target from 0 to 100.
2. `peek`: pass gate to the 출제자 only. Holding shows the dial with the target band; releasing hides it.
3. `clue`: the 출제자 says a clue aloud ("신라면"). An optional field lets them type it so it stays on screen as a reminder.
4. `tune`: the shared dial screen. The team drags the needle; the 출제자 must stay silent. A big **고정!** button locks it.
5. `reveal`: the target band sweeps in over the locked needle; score caption pops ("과녁 정중앙!").
6. `next`: rotate the 출제자; after 5 rounds, show the team total.

**Scoring** (distance between needle and target, on 0–100):

| Distance | Points | Caption |
| --- | --- | --- |
| 0–4 | 4 | 과녁 정중앙! |
| 5–12 | 3 | 거의 다 왔다! |
| 13–20 | 2 | 나쁘지 않아 |
| over 20 | 0 | 텔레파시 실패 |

Team goal for a 5-round session: 12 points = "찰떡궁합", 16+ = "이심전심". Totals are kept as a team best on the scoreboard.

**Dial interaction:**

- An SVG half circle, 180°, mapped to 0–100. Needle angle from `Math.atan2` of the pointer position relative to the dial centre, clamped to the half circle.
- Pointer Events (`pointerdown/move/up`) with `setPointerCapture`, so a thumb sliding off the dial still drags. `touch-action: none` on the dial only.
- Haptic tick every 5 units (`navigator.vibrate(5)` where supported; iOS ignores it silently).
- The target band is drawn only in `peek` and `reveal`; it is not in the DOM during `tune`, so it can't be glimpsed through a transition.

**Content used:** `spectrums`: about 120 Korean everyday pairs, e.g. 혼밥하기 쉬운 메뉴 ↔ 어려운 메뉴, 쉬운 노래방 곡 ↔ 어려운 노래방 곡, 아침 메뉴 ↔ 야식 메뉴, 과소평가 ↔ 과대평가, 무서운 놀이기구 ↔ 귀여운 놀이기구.

## Game 3 · 1부터 10까지 (Scale of 10)

Four players each get a secret number from 1 to 10 and answer a theme with that much intensity; the 선장 puts them in order from smallest to largest. Fully cooperative, about 2–3 minutes per round.

**Rules card:**

> 선장 빼고 모두 비밀 숫자(1\~10)를 받아요.
>
> 주제에 맞춰, 내 숫자만큼의 강도로 대답해요.
>
> 선장이 작은 수부터 순서대로 맞히면 성공!

**Roles at 5:** 선장 ×1 (rotates), 대답하는 사람 ×4. Numbers are drawn from 1–10 **without repeats**, so ties never happen.

**Phases:**

1. `setup`: draw a theme with labelled ends, e.g. "놀이공원에서 들으면 무서운 말 (1 = 하나도 안 무서움, 10 = 소름 끼침)". The theme shows in a big caption for everyone, including the 선장.
2. `deal`: pass-gate loop over the 4 answerers; the gate tells the 선장 "선장은 보지 마세요". Hold to see your number on a 1–10 colour scale.
3. `answer`: each answerer speaks their answer aloud in turn. The 선장 can tap a player's card to jot a 2–3 word memo ("롤러코스터 고장").
4. `sort`: the 선장 drags the 4 name cards into order, smallest at the top; **확정** locks it.
5. `reveal`: numbers flip one by one from the top. A card smaller than any already revealed is out of order and costs 1 하트.
6. `next`: rotate the 선장; after 5 rounds the session ends.

**Scoring:** the team starts a 5-round session with 8 하트. Each out-of-order card costs 1. End states: all rounds done with hearts left = "팀 승리", with the remaining hearts as the session score; 0 hearts = "아쉽다! 다시 도전". A perfect round shows "완벽한 선장!".

**Sorter interaction:**

- Vertical list of 4 cards, each 72 px tall, player colour on the left edge, memo below the name.
- Drag by long-press (200 ms) with Pointer Events; cards slide to make room. Up/down arrow buttons on each card as a fallback for one-handed or accessibility use.
- `reveal` uses the same list, so the 선장 sees exactly what they locked.

**Content used:** `scales`: about 150 Korean themes, each with `low` and `high` labels. Examples: 소개팅에서 하면 안 되는 말 (괜찮음 → 최악), 편의점 야식 조합 (평범 → 천재적), 웨이팅 2시간 맛집의 메뉴 (그럭저럭 → 인생 메뉴), 회식 장소 (최악 → 최고).

## Game 4 · 사라지는 힌트 (Fading Clues)

The 출제자 writes four clues for a secret word; each guesser in turn sees the remaining clues, secretly writes a guess, and erases one clue for the next person. About 3–4 minutes per round.

**Rules card:**

> 출제자가 제시어에 대한 힌트를 4개 써요.
>
> 폰을 받으면 몰래 정답을 쓰고, 힌트 하나를 지워요.
>
> 맞히면 1점, 출제자는 맞힌 사람 수만큼 점수!

**Roles at 5:** 출제자 ×1 (rotates), 맞히는 사람 ×4 in a fixed order that also rotates, so nobody is always last with one clue.

**Phases:**

1. `pick`: pass gate to the 출제자, who sees 3 candidate words from one category (음식, 장소, 동물, 물건, 드라마·예능) and picks one, like the category choice in the published game ([BoardGameGeek](https://boardgamegeek.com/boardgame/422750/eraser)).
2. `write`: the 출제자 types 4 clues, one field each. A clue containing the answer (after `norm()`) is rejected: "정답이 들어가 있어요".
3. `guess` (×4): pass gate to the next guesser. The screen shows the remaining clues as big cards. They type a guess (hidden as ●●● after **확인**), then tap one clue to erase it; the card crumbles away. The input is cleared and blurred before the gate.
4. `reveal`: everyone sees the answer, then each guess appears one at a time in order. Auto-judged with `norm()` and aliases; tap a guess to toggle 정답 인정.
5. `score`: points added, next 출제자.

**Scoring** (as in the published game: the writer scores per correct guesser, guessers score only if right, per [Games of Berkeley](https://gamesofberkeley.com/products/eraser)):

| Who | Points |
| --- | --- |
| Each correct guesser | +1 |
| 출제자 | +1 per correct guesser (max +4) |

**Edge cases:**

- Guesser 4 sees exactly one clue; this is intended and is the tense moment of the round.
- The erase step is mandatory (except for guesser 4, who has nothing to pass on), so a player can't stall.
- A guess is locked once confirmed; a typo like 떡뽁이 is handled at reveal by aliases or 정답 인정.
- Clues can be short phrases (up to 12 characters), not just single words, since Korean compounds are naturally long.

**Content used:** `words` tagged with categories, plus a 드라마·예능 category of well-known Korean titles.

## Game 5 · 숨은 조력자 스무고개 (Insider-style)

The 진행자 and a secret 숨은 조력자 know the word; everyone fires yes/no questions at the 진행자 against a timer, and once the word is found the group hunts the helper who steered them. About 5–7 minutes.

**Rules card:**

> 진행자와 숨은 조력자만 정답을 알아요.
>
> 모두 진행자에게 예/아니오 질문! 제한 시간 4분.
>
> 정답을 맞히면, 이제 숨은 조력자를 찾아요!

**Roles at 5:** 진행자 ×1 (public, rotates), 숨은 조력자 ×1 (secret), 일반 참가자 ×3.

**Phases:**

1. `setup`: the app picks the 진행자 by rotation, secretly picks the 조력자 from the other four, and draws a concrete, yes/no-friendly word.
2. `reveal`: pass-gate loop over all 5. 진행자 sees "당신은 진행자" + word. 조력자 sees "당신은 숨은 조력자" + word. 일반 sees "당신은 일반 참가자" and no word. All three screens share one layout, so they look alike from the side.
3. `questions`: the 진행자 holds the phone. A big countdown (default 4:00, adjustable 3–5) and three buttons: 정답 나왔다!, 단어 다시 보기 (hold), 일시정지. The 진행자 answers aloud: 예 / 아니오 / 몰라요.
4. `whoGuessed`: on 정답 나왔다!, the 진행자 taps who said it. If the timer reaches 0 first, everyone loses and the word is shown.
5. `discuss`: a second timer equal to the time the questioning took, as in the original ([Shut Up & Sit Down](https://www.shutupandsitdown.com/games/insider/)). Suspicious over-helpfulness is the thing to argue about.
6. `vote`: "하나, 둘, 셋!" everyone points; the 진행자 taps the accused; the 진행자 breaks ties.
7. `result`: "조력자 검거!" or "조력자 승리!", roles revealed.

**Scoring:**

| Outcome | Points |
| --- | --- |
| Word not found in time | Nobody scores |
| Word found, 조력자 caught | 진행자 and each 일반 +1 |
| Word found, 조력자 escapes | 조력자 +3 |

**Design notes:**

- Words must be guessable by yes/no questions: concrete nouns, easy to medium (붕어빵, 회전목마, 우산), never abstract.
- The original has two votes; v1 uses one combined vote for speed in a queue. Two-step voting can be an option later.
- If the 조력자 is the one who guessed the word, that's legal and often suspicious; the UI highlights the guesser's name during discussion.

**Content used:** `words` filtered by `yesno: true` and difficulty ≤ medium.

## Game 6 · 겹치면 꽝 (Just One-style)

The 술래 doesn't see the word; the other four each secretly type a one-word clue, identical clues cancel out, and the 술래 guesses from what survives. Cooperative, about 1–2 minutes per word. A session is one card per player by default (5 at 5 players); 3장 and 10장 are options.

**Rules card:**

> 술래만 제시어를 몰라요.
>
> 나머지는 몰래 한 단어 힌트를 써요. 겹치면 꽝!
>
> 남은 힌트로 술래가 맞히면 성공!

**Roles at 5:** 술래 ×1 (rotates every word, so with the default deck each player is 술래 once unless a 틀림 burns a card), 힌트 주는 사람 ×4.

**Phases:**

1. `setup`: shows "민지가 술래! 술래는 뒤돌아 주세요" in a big caption. The app draws the next word from the session deck.
2. `clue` (×4): pass gate to each clue-giver. Hold to see the word, release, then type one clue. Validation: no spaces, at most 10 characters, must not contain the answer. Input cleared and blurred before the next gate.
3. `compare`: a gate reading "술래 빼고 보세요". All 4 clues appear; exact duplicates after `norm()` are already struck through as 꽝. Clue-givers can tap two clues and press **같은 말** to cancel near-duplicates (고양이 / 냥이), or press **무효** for an invalid clue (same root, translation, sound-alike), following the published rule set ([official rules PDF](https://x.boardgamearena.net/data/rules/justone/JO_EN_Rules.pdf)).
4. `guess`: pass to the 술래. Surviving clues show as big cards; cancelled ones as grey 꽝 cards so the 술래 knows how many were lost. The 술래 says a guess aloud, then the group taps 맞음 / 틀림 / 패스.
5. `reveal`: the word appears with a caption; next 술래.

**Scoring (team):**

| Result | Effect on the deck |
| --- | --- |
| 맞음 | +1 point |
| 패스 | Card discarded, no point |
| 틀림 | Card discarded and the next card discarded too |

Final team score out of the deck size, with captions by share: 100% "완벽해요!", 80%+ "대단해요", 60%+ "괜찮은데?", 40%+ "조금만 더", below that "다시 해봐요" (for 10 cards: 10, 8–9, 6–7, 4–5, 0–3).

**Edge cases:**

- If all clues are cancelled, the card is lost automatically: "전부 꽝!"
- With 4 clue-givers the original's two-clues variant isn't needed.
- Duplicate detection never auto-strips particles; the human "같은 말" tap handles 사과 / 사과를 style cases.

**Content used:** `words` at easy and medium difficulty, excluding the 드라마·예능 and 영화 categories (screen titles are too easy to clue).

## File structure and module contracts

The app is one `public/` folder deployed as-is; games are self-contained modules that share one store and one set of UI components. App name on the home screen: **웨이팅 게임**.

```text
waiting-game/
├── wrangler.jsonc              # Cloudflare config (assets only, no Worker code)
├── SPEC.md                     # this spec, exported; every AI prompt references it
├── tools/
│   ├── lint_content.py         # schema, duplicates, font coverage
│   └── subset_font.py          # fontTools subset of 도현체 to used syllables
├── tests/                      # node --test, no dependencies
│   ├── josa.test.js  norm.test.js  rng.test.js  store.test.js
│   └── games/  liar.test.js  dial.test.js  scale10.test.js
│               fading.test.js  twenty.test.js  kkwang.test.js
└── public/
    ├── index.html              # one page; <div id="app">
    ├── manifest.webmanifest
    ├── sw.js                   # precache + offline
    ├── _headers                # cache + noindex headers
    ├── robots.txt
    ├── icons/                  # 192, 512, maskable-512, apple-touch-icon-180
    ├── fonts/dohyeon-sub.woff2
    ├── css/  tokens.css  base.css  components.css  games.css
    ├── content/  words.ko.json  spectrums.ko.json  scales.ko.json
    └── js/
        ├── app.js              # boot, render loop, screen routing
        ├── store.js            # state, dispatch, persistence, undo
        ├── rng.js              # seeded PRNG
        ├── content.js          # load + index packs, draw without repeats
        ├── i18n/  ko.js  josa.js  norm.js
        ├── ui/    h.js  gate.js  hold.js  caption.js  timer.js  vote.js
        │          sorter.js  dial.js  koinput.js  scoreboard.js
        │          sheet.js  haptics.js  wakelock.js
        ├── screens/  home.js  roster.js  rules.js  session.js  settings.js
        └── games/
            ├── registry.js
            ├── liar.js      # 라이어 찾기
            ├── dial.js      # 마음 다이얼
            ├── scale10.js   # 1부터 10까지
            ├── fading.js    # 사라지는 힌트
            ├── twenty.js    # 숨은 조력자 스무고개
            └── kkwang.js    # 겹치면 꽝
```

**The game module contract.** Every file in `games/` default-exports one object of this shape; the shell never knows game-specific rules.

```js
// games/liar.js (shape shared by all six)
export default {
  id: 'liar',
  title: '라이어 찾기',
  rules: ['라이어만 제시어를 몰라요.', '한 명씩 돌아가며 제시어를 한 문장으로 설명해요.',
          '라이어를 찾으면 시민 승! 라이어가 제시어를 맞히면 역전!'],
  players: { min: 4, max: 6, best: 5 },
  minutes: [3, 5],
  options: {
    mode:  { label: '모드', choices: ['일반', '바보'], default: '일반' },
    topic: { label: '주제', choices: 'content:categories', default: '랜덤' },
    timer: { label: '토론 시간', choices: [0, 120, 180, 300], default: 180 },
  },

  // Pure functions only: no DOM, no Date.now(), no Math.random().
  init({ players, options, content, seed }) { /* → state */ },
  reduce(state, action) { /* → new state; never mutate */ },
  view(state) { /* → { screen: 'gate' | 'hold' | 'talk' | 'vote' | ..., props } */ },
  result(state) { /* → null while playing, else { caption, points: { [playerId]: n } } */ },
};
```

**Rules for every reducer:**

- Actions are plain objects: `{ type: 'PEEKED', playerId }`, `{ type: 'ACCUSE', playerId }`, `{ type: 'TICK', now }`.
- Time enters only through actions (`now` comes from the UI), so tests can fast-forward timers.
- Randomness comes only from the seeded generator stored in state (see State section).
- Unknown actions return the same state object unchanged.
- `view()` decides which shared component appears; it never returns HTML.

`registry.js` imports the six modules and exposes `games` as an ordered list for the home screen.

## State, persistence, randomness and resume

One JSON state object is the single source of truth; it is written to `localStorage` after every action, so the app can be killed at any instant and resume exactly where it was.

```js
// store.js: the whole persisted shape (key 'wg:v1')
{
  schema: 1,
  roster:   [{ id: 'p1', name: '민지', color: 'yellow' }, /* … 4 more */],
  settings: { theme: 'auto', haptics: true, timerDefaults: {} },
  session:  { id: 's_20261001', scores: { p1: 0 }, rounds: [ /* {gameId, points, at} */ ] },
  game:     { id: 'liar', state: { /* the game's own reducer state */ } } | null,
  recent:   { words: ['w0123'], spectrums: [], scales: [] },  // ring buffers, 200 max
  fairness: { liar: { p1: 2 }, leader: { p1: 3 } },           // role counts for rotation
}
```

**Dispatch flow:** UI event → `dispatch(action)` → game `reduce()` (or a shell reducer for roster, session, settings) → push the previous state on a 10-step undo stack → `localStorage.setItem` → re-render.

**Resume rules:**

- On boot, if `game` exists, the home screen shows a big **이어서 하기** card (game name, round, whose turn).
- Secrets render only while a finger is down, so a fresh load can never show one. If the saved view was a reveal, it resumes at the pass gate for the same player.
- Timers store a `deadline` (or `remaining` when paused). Leaving the page (`visibilitychange` → hidden) auto-pauses; returning shows "일시정지됨 · 계속하기".
- A `schema` number plus a `migrate(old)` function keeps saved data valid across updates; unreadable data resets to defaults with a toast rather than crashing.

**Randomness:** a small seeded generator makes every round reproducible in tests and lets the state carry its own RNG position.

```js
// rng.js: mulberry32; state.rng is a 32-bit integer stored in the game state
export function next(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: (seed + 0x6d2b79f5) >>> 0 };
}
// Reducers call next(state.rng) and store the returned seed back into the new state.
```

The UI creates the first seed with `crypto.getRandomValues` when a game starts; after that, everything is deterministic.

**Fair rotation:** secret roles (라이어, 조력자) go to the player with the fewest past turns in that role, with the RNG breaking ties, so nobody is the liar three times in a row. Leader roles (출제자, 선장, 진행자, 술래) rotate in roster order, starting after whoever led last.

**No repeats:** content draws skip anything in `recent`; when a pool runs dry, the oldest half of the buffer is released.

**Undo:** a small **되돌리기** button on vote and judging screens restores the previous state, for the inevitable wrong tap in a moving queue.

## Shared UI components

Eleven reusable components cover every screen in all six games; games only choose which one to show and with what props.

| Component | Used by | Behaviour that matters |
| --- | --- | --- |
| `gate` (pass gate) | All | Full screen in the next player's colour: "민지에게 폰을 넘겨주세요". Button **제가 민지예요** must be tapped, so a bumped screen never advances |
| `hold` (hold-to-reveal) | All | `pointerdown` shows the secret; `pointerup`, `pointercancel`, `pointerleave` and `visibilitychange` hide it; auto-hide after 3 s. `user-select: none`, `-webkit-touch-callout: none`, `contextmenu` blocked so a long press can't select or copy |
| `caption` | Results, reveals | The signature variety-show caption (see Design system). One per screen, never two |
| `timer` | 라이어, 스무고개, optional elsewhere | Ring countdown, 일시정지, +30초. Auto-pauses when hidden. Last 10 s pulse plus a haptic |
| `vote` (point vote) | 라이어, 스무고개 | "하나, 둘, 셋!" 3-second countdown, then a grid of player names; tie handling lives in the game reducer |
| `sorter` | 1부터 10까지 | Long-press drag list with arrow-button fallback |
| `dial` | 마음 다이얼 | SVG half circle, pointer capture, needle 0–100, haptic ticks |
| `koinput` | 사라지는 힌트, 겹치면 꽝, 라이어 | IME-safe input (see Korean localization). Keeps its own value; dispatches only on **확인** |
| `scoreboard` | Home, results | Five rows, colour chip + name + total, tabular numbers, today's leader marked 오늘의 1등 |
| `sheet` | Everywhere | Bottom sheet for confirms: "게임을 끝낼까요?" with 계속하기 / 끝내기 |
| `haptics`, `wakelock` | Shell | Small wrappers that fail silently where unsupported |

**Rendering approach.** A 20-line `h(tag, props, ...children)` helper builds DOM nodes; `app.js` re-renders the current screen into `#app` after each dispatch. Two exceptions avoid fighting the user:

- **Inputs are never re-rendered while focused.** `koinput` owns its DOM node and value until **확인**, so Hangul composition is never interrupted.
- **Drag components (`dial`, `sorter`) update their own DOM during a drag** and dispatch once on release.

**Accessibility floor:** every interactive element is a real `<button>` or `<input>` at least 56 px tall; visible focus rings; colour is never the only signal (names always shown); `prefers-reduced-motion` turns animations into instant swaps; `aria-live="polite"` on result captions.

## Design system

The look borrows from two places Korean players already associate with fun: **variety-show captions (예능 자막)** for the big reveal moments, and **포장마차 night colours** for the palette. Everything else stays flat and quiet so the one loud element lands.

### Palette

| Token | Name | Hex | Role |
| --- | --- | --- | --- |
| `--ink` | 먹색 | #141833 | Text in day mode, caption outline |
| `--paper` | 낮 바탕 | #FFFFFF | Day background, chosen for sunlight contrast |
| `--night` | 밤하늘 남색 | #1B2150 | Night background (easier on battery and eyes indoors) |
| `--caption` | 자막 노랑 | #FFD400 | Caption fill, primary buttons |
| `--tarp` | 포차 주황 | #FF6A13 | Timers, highlights, 하트 |
| `--good` / `--bad` | 소주병 초록 / 꽝 빨강 | #00A86B / #E8343A | Correct / wrong, always paired with a word |

Player colours (one per roster slot, always shown with the name): 노랑 #FFD400, 주황 #FF6A13, 하늘 #2EA8FF, 초록 #00A86B, 분홍 #FF5FA8.

### Type

- **도현체** for captions, player names on the pass gate, and secret words. One weight, used big.
- **System Korean sans** for everything else. Body at 19 px (larger than usual, for arm's-length reading outdoors), line-height 1.5; titles 30 px, line-height 1.2; small text 15 px, used sparingly.
- Caption size `clamp(44px, 14vw, 72px)`; a secret word never wraps to more than 2 lines.

### The signature element: 자막 caption

Yellow 도현체 text with a thick ink outline and a hard offset shadow, tilted -2°, popping in once (scale 0.6 → 1.06 → 1 over 220 ms). It appears only on reveals and results: "라이어 검거!", "과녁 정중앙!", "꽝!". Never two on one screen.

```css
.caption {
  font: 400 var(--fs-caption)/1.05 var(--font-display);
  color: var(--caption);
  -webkit-text-stroke: 0.12em var(--ink); paint-order: stroke fill; /* outline behind fill */
  text-shadow: 0.06em 0.06em 0 var(--ink);
  transform: rotate(-2deg);
  animation: pop 220ms cubic-bezier(.2,.9,.3,1.3) both;
}
@keyframes pop { from { transform: scale(.6) rotate(-6deg); } 70% { transform: scale(1.06) rotate(-1deg); } }
@media (prefers-reduced-motion: reduce) { .caption { animation: none; } }
```

### Tokens

```css
/* css/tokens.css */
:root {
  --ink:#141833; --paper:#FFFFFF; --night:#1B2150;
  --caption:#FFD400; --tarp:#FF6A13; --good:#00A86B; --bad:#E8343A;
  --p1:#FFD400; --p2:#FF6A13; --p3:#2EA8FF; --p4:#00A86B; --p5:#FF5FA8;
  --bg:var(--paper); --fg:var(--ink); --muted:#555B7A; --line:#D8DBE8;
  --font-body:"Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR","Malgun Gothic",system-ui,sans-serif;
  --font-display:"DoHyeon",var(--font-body);
  --fs-caption:clamp(44px,14vw,72px); --fs-title:30px; --fs-body:19px; --fs-small:15px;
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
  --r-btn:18px; --r-card:12px;          /* buttons rounder than cards; captions square */
  --tap:60px;                            /* minimum button height */
}
:root[data-theme="night"] { --bg:var(--night); --fg:#F4F5FF; --muted:#A9AEDA; --line:#343B78; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="day"]) { --bg:var(--night); --fg:#F4F5FF; --muted:#A9AEDA; --line:#343B78; }
}
body { background:var(--bg); color:var(--fg); font:400 var(--fs-body)/1.5 var(--font-body);
       word-break:keep-all; overflow-wrap:anywhere; letter-spacing:-0.01em; }
```

A 낮 / 밤 toggle sits in the top bar; default follows the phone's setting.

### Layout

Single column, max width 480 px, centred on larger screens. Top bar (pause, game name, round) is 48 px; a bottom action dock holds every button, padded with `env(safe-area-inset-bottom)`. Instructions are left-aligned; the one big name or secret is centred.

```text
PASS GATE                     HOLD TO REVEAL                TALK
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ ⏸  라이어 찾기  2/5    │     │ ⏸  라이어 찾기  2/5    │     │ 주제: 음식     ⏱ 2:41 │
│                      │     │ 꾹 누르는 동안만 보여요  │     │                      │
│   (player colour)    │     │ ┌──────────────────┐ │     │ 지금 말할 사람          │
│        민지          │     │ │                  │ │     │        준혁            │
│ 에게 폰을 넘겨주세요   │     │ │  [ 떡볶이 ]       │ │     │                      │
│                      │     │ │   주제: 음식       │ │     │ 다음: 서연 → 도윤 → 민지 │
│ ┌──────────────────┐ │     │ └──────────────────┘ │     │ ┌───────┐ ┌────────┐ │
│ │  제가 민지예요    │ │     │ ┌──────────────────┐ │     │ │한 바퀴│ │투표하기│ │
│ └──────────────────┘ │     │ │ 확인했어요        │ │     │ └───────┘ └────────┘ │
└──────────────────────┘     └──────────────────────┘     └──────────────────────┘
```

The hold area fills the lower 55% of the screen, where the thumb already rests.

### Motion and haptics

- Motion only answers an action: the caption pop, a clue card crumbling in 사라지는 힌트, the dial target sweeping in, sorter cards sliding. No idle animation.
- Haptics (Android; iOS web ignores vibration): turn change 15 ms; time up \[80, 60, 80\]; correct \[20, 40, 20\]; dial tick 5 ms.
- No sound in v1: useless in a loud queue, rude in a quiet restaurant.

### Check against generic defaults

Per the design skill's review step, each choice was tested against the defaults a generator reaches for. A near-black base with one neon accent was replaced by an indigo night plus five identity colours. A cream background was replaced by pure white for sunlight. Identical rounded cards everywhere were replaced by radii that differ by role (pill-ish buttons, softer cards, square captions). The caption is the only decorative flourish; there are no gradients, glass effects or soft drop shadows.

## Korean content packs

Three JSON files hold all content: about 700 words, 120 spectrum pairs and 150 scale themes, drafted with AI in Korean and pruned by the group before the first trip.

**Schemas:**

```json
// content/words.ko.json — used by 라이어 찾기, 사라지는 힌트, 스무고개, 겹치면 꽝
{ "version": 1, "words": [
  { "id": "w0001", "text": "떡볶이", "cat": "분식·간식", "diff": 1,
    "yesno": true, "decoy": "순대", "aliases": ["떡뽁이"], "tags": ["웨이팅"] }
]}

// content/spectrums.ko.json — 마음 다이얼
{ "version": 1, "spectrums": [
  { "id": "d001", "left": "혼밥하기 쉬운 메뉴", "right": "혼밥하기 어려운 메뉴", "diff": 1 }
]}

// content/scales.ko.json — 1부터 10까지
{ "version": 1, "scales": [
  { "id": "t001", "theme": "놀이공원에서 들으면 무서운 말", "low": "하나도 안 무서움", "high": "소름 끼침" }
]}
```

Field rules: `diff` 1 = easy, 2 = medium, 3 = hard; `yesno` marks words guessable by yes/no questions (스무고개); `decoy` is a near neighbour for 바보 모드; `aliases` are accepted spellings; `tags` drive context packs.

**Word categories and target sizes:**

| Category | Target | Sample words |
| --- | --- | --- |
| 음식 | 70 | 김치찌개, 삼겹살, 냉면, 비빔밥 |
| 분식·간식 | 60 | 떡볶이, 붕어빵, 호떡, 탕후루 |
| 장소 | 70 | 찜질방, 편의점, 노래방, 한강공원 |
| 동물 | 60 | 고양이, 펭귄, 수달, 판다 |
| 물건 | 70 | 우산, 보조배터리, 이어폰, 셀카봉 |
| 직업 | 50 | 소방관, 바리스타, 유튜버, 택배기사 |
| 학교·회사 | 50 | 수학여행, 회식, 야근, 운동회 |
| 여행 | 50 | 여권, 기내식, 캐리어, 환전 |
| 놀이공원 | 60 | 회전목마, 츄러스, 퍼레이드, 머리띠 |
| 스포츠·취미 | 50 | 볼링, 등산, 뜨개질, 클라이밍 |
| 계절·날씨 | 40 | 장마, 첫눈, 벚꽃, 열대야 |
| 드라마·예능 | 70 | Well-known Korean titles and show formats; 사라지는 힌트 and 라이어 only |
| 영화 | 50 | 천만 영화 and worldwide hits: 기생충, 부산행, 겨울왕국, 어바웃 타임; like 드라마·예능, kept out of 겹치면 꽝 |
| 편의점 간식 | 60 | Snack, ice cream, drink and ramen brands: 새우깡, 메로나, 바나나맛우유, 신라면 |
| 과일 | 30 | 사과, 샤인머스캣, 감귤, 단감; 1-syllable fruits (배, 귤, 감) only as decoys or aliases |
| 프랜차이즈 | 20 | Coffee, burger, chicken and bakery chains: 스타벅스, 메가커피, 맘스터치, BBQ |
| 브랜드 | 30 | Stores, fashion, tech and apps: 다이소, 나이키, 카카오톡, 당근마켓 |
| 캐릭터 | 30 | 뽀로로, 짱구, 피카츄, 라이언, 펭수 |
| 게임 | 20 | Games a 30s group grew up with: 스타크래프트, 카트라이더, 메이플스토리, 애니팡 |

**Context packs** are filters over tags, chosen on the home screen: **놀이공원** (rides, snacks, souvenirs) and **웨이팅 맛집** (dishes and restaurant words, for the classic Seoul restaurant queue).

**Authoring workflow:**

1. Prompt an AI in Korean per category, e.g. "음식 카테고리 단어 80개. 초등학생도 아는 쉬운 단어 50%, 보통 40%, 어려운 10%. 각 단어에 비슷하지만 다른 단어(decoy) 하나씩. JSON으로."
2. One person reads every list and deletes anything obscure, ambiguous, regional or no fun. Quality beats count: one bad word kills a round.
3. Run `python tools/lint_content.py`, which checks: valid schema, unique IDs, no duplicate `text` after `norm()`, every `decoy` differs from its word, no syllable outside the 도현체 subset.
4. Run `python tools/subset_font.py` to rebuild `dohyeon-sub.woff2` from every character in the content and UI strings.
5. Commit; deploy.

**Writing rules for content:** words are 2–6 syllables; no real private people; themes in 1부터 10까지 must read naturally on both ends ("하나도 안 무서움" → "소름 끼침").

## Offline PWA and iOS specifics

After one visit on Wi-Fi, every file lives in the service-worker cache and the app opens in airplane mode; updates install only when someone taps **업데이트** on the home screen, never mid-game.

**`index.html` head essentials:**

```html
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1B2150" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-title" content="웨이팅 게임">
<meta name="robots" content="noindex">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
<link rel="preload" href="/fonts/dohyeon-sub.woff2" as="font" type="font/woff2" crossorigin>
<script type="module" src="/js/app.js"></script>
```

Zoom is not disabled (accessibility); `touch-action: manipulation` on buttons stops double-tap zoom instead.

**`manifest.webmanifest`:**

```json
{ "name": "웨이팅 게임", "short_name": "웨이팅 게임", "lang": "ko",
  "start_url": "/?src=home", "scope": "/", "display": "standalone", "orientation": "portrait",
  "background_color": "#1B2150", "theme_color": "#1B2150",
  "icons": [ { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
             { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
             { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```

**`sw.js` (complete strategy):**

```js
const VERSION = 'wg-2026-10-01a';            // bump on every deploy
const FILES = ['/', '/index.html', '/manifest.webmanifest', '/css/tokens.css', /* …every file */
               '/content/words.ko.json', '/fonts/dohyeon-sub.woff2'];

self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES))));      // no skipWaiting here

self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then((hit) => hit || fetch(e.request).catch(() => caches.match('/index.html'))));
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
```

- Cache-first for everything: the app never waits on the network.
- A new version installs in the background and waits. The home screen (only) shows "새 버전이 있어요 · 업데이트"; tapping posts `SKIP_WAITING` and reloads.
- `FILES` is hand-maintained (no build step), so `tests/precache.test.js` walks `public/` and fails if any file is missing from the list.
- Home screen badge **오프라인 준비 완료** appears once every entry in `FILES` is found in the cache.

**iOS specifics:**

- iOS has no install prompt, so first launch in Safari shows a one-time Korean guide: "공유 버튼 → 홈 화면에 추가".
- Service-worker offline caching has worked on iOS since 11.3 ([firt.dev](https://firt.dev/notes/pwa-ios/)); wake lock in home-screen apps needs iOS 18.4+ ([WebKit](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)).
- Call `navigator.storage.persist()` once after install to ask the browser not to evict saved scores and state.
- `navigator.vibrate` doesn't exist on iOS; `haptics.js` checks for it and does nothing.
- Respect the notch and home indicator with `env(safe-area-inset-*)` padding on the top bar and bottom dock.

**Wake lock helper:**

```js
// ui/wakelock.js: keep the screen on during active rounds only
let lock = null, wanted = false;
export async function keepAwake(on) {
  wanted = on;
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) { await lock.release(); lock = null; }
  } catch { /* unsupported or denied: ignore */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wanted) keepAwake(true); // the OS drops it when hidden
});
```

## Cloudflare deploy

Deploy is a Worker with only static assets: one small config file, no server code, free, with `_headers` supported natively ([Cloudflare docs](https://developers.cloudflare.com/workers/static-assets/compatibility-matrix)).

**`wrangler.jsonc`:**

```json
{
  "name": "waiting-game",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./public",
    "not_found_handling": "single-page-application"
  }
}
```

With `single-page-application`, any unknown path serves `index.html`, so a mistyped or old link still opens the app ([Cloudflare SPA docs](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)).

**`public/_headers`:**

```text
/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable
```

- The strict CSP is possible because the app loads nothing from other domains; it also blocks accidental third-party scripts an AI might add. Code must set styles through `el.style` properties or CSS variables, never a `style="…"` attribute string, which this policy blocks.
- Fonts and icons are cached forever; if one changes, it gets a new file name. Everything else keeps the default revalidation, and the service worker handles offline.
- `robots.txt` contains `User-agent: *` and `Disallow: /`.

**Steps:**

1. Create a free Cloudflare account; install Node 20+.
2. `npx wrangler login` once.
3. `npx wrangler dev` serves `public/` locally for testing (service workers work on localhost).
4. `npx wrangler deploy` publishes to `https://waiting-game.<your-subdomain>.workers.dev`.
5. Optional: connect the GitHub repo in the Cloudflare dashboard so every push to `main` deploys.
6. Before each trip: bump `VERSION` in `sw.js`, deploy, open the app on all 5 phones on Wi-Fi, confirm the 오프라인 준비 완료 badge, then **freeze deploys** until you're home.

## Testing and acceptance criteria

Game logic is tested automatically with Node's built-in test runner (no dependencies); the phone experience is tested by hand against a fixed checklist before every outing.

**Automated (`node --test tests/`):**

| Test file | What it proves |
| --- | --- |
| `josa.test.js` | 민지야/준혁아, 민지가/준혁이, 서울로/부산으로/물로, non-Hangul fallback |
| `norm.test.js` | NFC vs NFD input match, spaces and punctuation ignored, 고양이 not stripped |
| `rng.test.js` | Same seed gives the same sequence; values in \[0, 1) |
| `store.test.js` | Save → reload round-trip; migration from an older schema; undo restores exactly |
| `games/*.test.js` | A full seeded playthrough of each game, every win/lose branch, tie rules, scoring tables from this spec, unknown actions ignored |
| `precache.test.js` | Every file in `public/` is listed in `sw.js` |

Example shape of a game test:

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import liar from '../../public/js/games/liar.js';

test('liar caught but guesses the word → liar +2', () => {
  let s = liar.init({ players: P5, options: { mode: '일반' }, content: C, seed: 42 });
  for (const p of P5) s = liar.reduce(s, { type: 'PEEKED', playerId: p.id });
  s = liar.reduce(s, { type: 'START_VOTE' });
  s = liar.reduce(s, { type: 'ACCUSE', playerId: s.liarId });
  s = liar.reduce(s, { type: 'LIAR_GUESS', correct: true });
  assert.deepEqual(liar.result(s).points, { [s.liarId]: 2 });
});
```

**Content (`python tools/lint_content.py`):** schema valid, unique IDs, no duplicate words after normalization, decoys differ, every syllable covered by the font subset.

**Device matrix:** every phone the group owns, installed to the home screen. At minimum one iPhone on iOS 18.4+, one older iPhone on iOS 17, and one Android on current Chrome.

**Acceptance criteria (all must pass before a park day):**

- [ ] Cold start to first pass gate in under 15 seconds, including roster load.
- [ ] All six games playable start to finish in airplane mode.
- [ ] Killing the app mid-round and reopening resumes at a pass gate with no secret visible.
- [ ] Locking the phone during a timer pauses it; unlocking shows 계속하기.
- [ ] Typing Korean clues with the default iOS and Samsung/Gboard keyboards never double-submits or drops a syllable.
- [ ] The keyboard suggestion bar never shows the previous player's clue.
- [ ] Secret words readable at arm's length in direct midday sun (day theme).
- [ ] Every rules card fits on one screen without scrolling at 375 px width.
- [ ] Scores persist across a full day and across app updates.
- [ ] No network request is made during play (check in browser dev tools).

## Vibe-coding prompt sequence

Build in 14 prompts, each small enough to review in a few minutes; commit after every step that passes its check.

Export this tab as `SPEC.md` into the repo first. Start every prompt with: *"Follow SPEC.md exactly. Plain HTML/CSS/JS ES modules, no frameworks, no dependencies, no build step. Korean UI. Change only the files named."*

1. **Skeleton.** "Create the folder structure from SPEC.md with empty files, `index.html` head as specified, `wrangler.jsonc`, `_headers`, `robots.txt`." Check: `npx wrangler dev` shows a blank page with no console errors.
2. **Korean helpers.** "Write `i18n/josa.js`, `i18n/norm.js`, `rng.js` and their tests." Check: `node --test` green.
3. **Store.** "Write `store.js`: state shape, dispatch, localStorage save on every action, schema migration, 10-step undo, plus `store.test.js`." Check: tests green.
4. **Design tokens and base CSS.** "Write `tokens.css` and `base.css` from the Design system section, including day/night themes and the `.caption` style." Check: a test page shows both themes and the caption.
5. **Shell UI.** "Write `ui/h.js`, `gate.js`, `hold.js`, `caption.js`, `sheet.js`, `haptics.js`, `wakelock.js` and `app.js` routing." Check: on a phone, the gate needs a tap and the secret hides the instant the finger lifts.
6. **Roster, home, rules, scoreboard screens.** "Write `screens/*` and `ui/scoreboard.js`. Home lists the six games with Korean names and minutes." Check: add 5 names, see them persist after reload.
7. **Content loader + starter packs.** "Write `content.js` (load, index, draw without repeats) and starter JSON with 20 entries per file." Check: draws never repeat within 20.
8. **Game: 라이어 찾기.** "Write `games/liar.js` (reducer only) and its full test, then `ui/vote.js` and `ui/timer.js`." Check: tests green, then play one real round with the group.
9. **Game: 겹치면 꽝.** "Write `games/kkwang.js`, its test, and `ui/koinput.js` with the IME rules." Check: type Korean clues on iPhone and Android; duplicates cancel.
10. **Game: 사라지는 힌트.** "Write `games/fading.js` and its test, reusing `koinput`." Check: clue count drops 4 → 1 across guessers.
11. **Game: 숨은 조력자 스무고개.** "Write `games/twenty.js` and its test, including the discussion timer equal to elapsed time."
12. **Games: 1부터 10까지 and 마음 다이얼.** "Write `games/scale10.js` with `ui/sorter.js`, then `games/dial.js` with `ui/dial.js`, each with tests." Check: drag works one-handed; target band absent from the DOM during `tune`.
13. **Offline.** "Write `manifest.webmanifest`, `sw.js`, `precache.test.js`, the update banner, the 오프라인 준비 완료 badge and the iOS install guide." Check: airplane-mode test on every phone.
14. **Full content and font.** Generate the full Korean packs with the authoring workflow, run `lint_content.py` and `subset_font.py`, deploy. Check: the acceptance checklist above.

After each step, ask the assistant: *"In 5 lines, what changed and what should I test by hand?"* That keeps you able to debug in a queue without the AI.

## Sources

- Korean liar game conventions: [alwayscorp 라이어게임](https://alwayscorp.co.kr/games/liar-game), [새로운 질서 위키: 라이어 게임](https://wiki.neworder.xyz/wiki/%EB%9D%BC%EC%9D%B4%EC%96%B4_%EA%B2%8C%EC%9E%84), [YC College blog](https://yccollege.website/Story/?bmode=view&idx=4650457)
- [Korea Boardgames: 저스트 원](https://www.koreaboardgames.com/product/detail?prdCd=PD2024002153LFWY), [Just One official rules (PDF)](https://x.boardgamearena.net/data/rules/justone/JO_EN_Rules.pdf)
- [Eraser on BoardGameGeek](https://boardgamegeek.com/boardgame/422750/eraser), [Eraser at Games of Berkeley](https://gamesofberkeley.com/products/eraser)
- [Insider (Shut Up & Sit Down)](https://www.shutupandsitdown.com/games/insider/)
- [BM DoHyeon (1001 Fonts)](https://www.1001fonts.com/bm-dohyeon-font.html), [Do Hyeon glyph count (FontMeme)](https://fontmeme.com/fonts/do-hyeon-font/)
- [Cloudflare: Workers static assets compatibility](https://developers.cloudflare.com/workers/static-assets/compatibility-matrix), [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [firt.dev iOS PWA compatibility](https://firt.dev/notes/pwa-ios/), [WebKit: Safari 18.4 features](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
