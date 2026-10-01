"""Rebuild public/fonts/dohyeon-sub.woff2 from every character used in content and UI strings.

    pip install fonttools brotli
    python tools/subset_font.py [path/to/DoHyeon-Regular.ttf]

The source font defaults to tools/fonts/DoHyeon-Regular.ttf. 도현체 (BM DoHyeon) is by Woowa
Brothers under the SIL Open Font License; download it from Google Fonts. The subset keeps
ASCII, Korean punctuation and every syllable that appears in public/content and public/js.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tools' / 'fonts' / 'DoHyeon-Regular.ttf'
OUT = ROOT / 'public' / 'fonts' / 'dohyeon-sub.woff2'
BUDGET = 250 * 1024


def used_chars():
    chars = set(chr(c) for c in range(0x20, 0x7F))           # ASCII
    chars |= set('·…→←↔↶▲▼◀▶♥✓✗–—~!?「」“”‘’')
    # The 2,350 common syllables (KS X 1001): player names are typed freely and shown in this font.
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('euc-kr'))
            except UnicodeDecodeError:
                pass
    for folder in ('content', 'js'):
        for f in (ROOT / 'public' / folder).rglob('*'):
            if f.suffix in ('.json', '.js'):
                chars |= set(f.read_text(encoding='utf-8'))
    return {c for c in chars if c.isprintable()}


def main():
    if not SRC.exists():
        sys.exit(f'Source font not found: {SRC}\nDownload DoHyeon-Regular.ttf (OFL) and pass its path.')
    from fontTools import subset
    chars = used_chars()
    hangul = sum(1 for c in chars if 0xAC00 <= ord(c) <= 0xD7A3)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(str(SRC), opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(chars))
    sub.subset(font)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUT), opts)
    cmap = font.getBestCmap()
    missing = sorted(c for c in chars if 0xAC00 <= ord(c) <= 0xD7A3 and ord(c) not in cmap)
    size = OUT.stat().st_size
    print(f'{OUT.relative_to(ROOT)}: {size / 1024:.1f} KB, {hangul} syllables requested, {len(missing)} not in 도현체 (fall back to body font)')
    if missing:
        print('  missing:', ''.join(missing[:60]))
    if size > BUDGET:
        print(f'  warning: over the {BUDGET // 1024} KB budget')
    print('Next: make sure /fonts/dohyeon-sub.woff2 is in FILES in public/sw.js and bump VERSION.')


if __name__ == '__main__':
    main()
