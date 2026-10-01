"""Content lint: schema, unique IDs, duplicate words after normalisation, decoys, banned words,
and (when the subset font exists) display-font coverage.

    python tools/lint_content.py
Exit code 1 on any error; warnings are printed but don't fail.
"""
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'public' / 'content'
FONT = ROOT / 'public' / 'fonts' / 'dohyeon-sub.woff2'
BANNED = ROOT / 'tools' / 'banned_words.txt'

CATS = {'음식', '분식·간식', '술·안주', '장소', '동물', '물건', '직업', '학창 시절', '직장 생활', '여행', '놀이공원',
        '스포츠·취미', '계절·날씨', '드라마·예능', '추억', '연애', '일상'}

errors, warnings = [], []
err = errors.append
warn = warnings.append


def norm(s):
    """Same rule as public/js/i18n/norm.js: NFC, lower case, drop spaces/punctuation/symbols."""
    s = unicodedata.normalize('NFC', str(s)).lower()
    return ''.join(ch for ch in s if not (ch.isspace() or unicodedata.category(ch)[0] in 'PS'))


def hangul_syllables(s):
    """Syllable count: Hangul syllables plus Latin letters/digits (PC방 = 3)."""
    return sum(1 for ch in s if 0xAC00 <= ord(ch) <= 0xD7A3 or (ch.isascii() and ch.isalnum()))


def load(name, key):
    data = json.loads((CONTENT / name).read_text(encoding='utf-8'))
    if data.get('version') != 1 or not isinstance(data.get(key), list):
        err(f'{name}: expected {{"version": 1, "{key}": [...]}}')
        return []
    return data[key]


def check_ids(name, items, prefix):
    seen = set()
    for it in items:
        i = it.get('id')
        if not isinstance(i, str) or not re.fullmatch(prefix + r'\d+', i):
            err(f'{name}: bad id {i!r}')
        if i in seen:
            err(f'{name}: duplicate id {i}')
        seen.add(i)


words = load('words.ko.json', 'words')
spectrums = load('spectrums.ko.json', 'spectrums')
scales = load('scales.ko.json', 'scales')
check_ids('words', words, 'w')
check_ids('spectrums', spectrums, 'd')
check_ids('scales', scales, 't')

seen_text = {}
for w in words:
    wid, text = w.get('id'), w.get('text', '')
    for field, typ in (('text', str), ('cat', str), ('diff', int), ('yesno', bool), ('decoy', str), ('aliases', list)):
        if not isinstance(w.get(field), typ):
            err(f'{wid}: field {field} should be {typ.__name__}')
    if w.get('cat') not in CATS:
        err(f'{wid}: unknown category {w.get("cat")!r}')
    if w.get('diff') not in (1, 2, 3):
        err(f'{wid}: diff must be 1, 2 or 3')
    n = norm(text)
    if not n:
        err(f'{wid}: empty text')
    if n in seen_text:
        err(f'{wid}: "{text}" duplicates {seen_text[n]} after normalisation')
    seen_text[n] = wid
    if w.get('decoy') and norm(w['decoy']) == n:
        err(f'{wid}: decoy equals the word')
    for a in w.get('aliases', []):
        if norm(a) == n:
            warn(f'{wid}: alias "{a}" is the same as the word after normalisation')
    if w.get('cat') != '드라마·예능':
        syl = hangul_syllables(text)
        if syl and not 2 <= syl <= 6:
            warn(f'{wid}: "{text}" has {syl} syllables (rule: 2–6)')

for d in spectrums:
    if not d.get('left') or not d.get('right'):
        err(f'{d.get("id")}: needs left and right')
    elif norm(d['left']) == norm(d['right']):
        err(f'{d["id"]}: left and right are the same')
for t in scales:
    if not t.get('theme') or not t.get('low') or not t.get('high'):
        err(f'{t.get("id")}: needs theme, low and high')

# Banned words: one per line, '#' comments allowed.
if BANNED.exists():
    banned = [norm(l) for l in BANNED.read_text(encoding='utf-8').splitlines() if l.strip() and not l.startswith('#')]
    all_text = [(w['id'], w.get('text', '')) for w in words] + [(w['id'], w.get('decoy', '')) for w in words] \
        + [(d['id'], d.get('left', '') + d.get('right', '')) for d in spectrums] \
        + [(t['id'], t.get('theme', '') + t.get('low', '') + t.get('high', '')) for t in scales]
    for i, s in all_text:
        for b in banned:
            if b and b in norm(s):
                err(f'{i}: contains banned word "{b}"')

# Font coverage: every Hangul syllable in content must exist in the subset font.
if FONT.exists():
    try:
        from fontTools.ttLib import TTFont
        cmap = TTFont(str(FONT)).getBestCmap()
        chars = set()
        for w in words:
            chars |= set(w.get('text', '') + w.get('decoy', ''))
        for d in spectrums:
            chars |= set(d['left'] + d['right'])
        for t in scales:
            chars |= set(t['theme'] + t['low'] + t['high'])
        missing = sorted(ch for ch in chars if 0xAC00 <= ord(ch) <= 0xD7A3 and ord(ch) not in cmap)
        if missing:
            warn(f'font: {len(missing)} syllables not in dohyeon-sub.woff2 (run tools/subset_font.py): {"".join(missing[:40])}')
    except ImportError:
        warn('fontTools not installed; skipped font coverage (pip install fonttools brotli)')
else:
    warn('font: public/fonts/dohyeon-sub.woff2 not found; captions fall back to the system font')

cats = {}
for w in words:
    cats[w['cat']] = cats.get(w['cat'], 0) + 1
print(f'{len(words)} words, {len(spectrums)} spectrums, {len(scales)} scales')
print('  ' + ', '.join(f'{c} {n}' for c, n in cats.items()))
for w in warnings:
    print('warn:', w)
for e in errors:
    print('ERROR:', e)
print('OK' if not errors else f'{len(errors)} error(s)')
sys.exit(1 if errors else 0)
