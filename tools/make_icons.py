"""Draw the home-screen icons (no font needed): a tilted 자막-yellow caption bar over a queue of
five player-colour dots on the night indigo.

    python tools/make_icons.py      (needs Pillow)
"""
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'icons'
NIGHT, INK, CAPTION = (27, 33, 80), (20, 24, 51), (255, 212, 0)
PLAYERS = [(255, 212, 0), (255, 106, 19), (46, 168, 255), (0, 168, 107), (255, 95, 168)]


def draw(size, safe=1.0):
    s = 4                                     # supersample, then downscale for smooth edges
    W = size * s
    img = Image.new('RGB', (W, W), NIGHT)
    d = ImageDraw.Draw(img)
    pad = W * (1 - safe) / 2
    u = (W - 2 * pad) / 100                   # 100-unit artboard inside the safe zone

    def P(x, y):
        return (pad + x * u, pad + y * u)

    # Caption bar: thick ink outline + hard offset shadow, rotated -6°.
    bar = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    b = ImageDraw.Draw(bar)
    x0, y0, x1, y1 = P(14, 24) + P(86, 52)
    b.rectangle((x0 + 4 * u, y0 + 4 * u, x1 + 4 * u, y1 + 4 * u), fill=INK)
    b.rectangle((x0, y0, x1, y1), fill=CAPTION, outline=INK, width=int(3.2 * u))
    # Three "speech" ticks on the caption, like 자막 text strokes.
    for i, w in enumerate((40, 30, 18)):
        tx0, ty0 = P(22, 31 + i * 6.5)
        tx1, ty1 = P(22 + w, 34.5 + i * 6.5)
        b.rectangle((tx0, ty0, tx1, ty1), fill=INK)
    bar = bar.rotate(6, resample=Image.BICUBIC, center=(W / 2, W * 0.4))
    img.paste(bar, (0, 0), bar)

    # The queue: five player dots, the first one larger (it's their turn).
    r = 7 * u
    for i, c in enumerate(PLAYERS):
        cx, cy = P(18 + i * 16, 74)
        rr = r * (1.25 if i == 0 else 1)
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=c, outline=INK, width=int(2 * u))
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
draw(192).save(OUT / 'icon-192.png', optimize=True)
draw(512).save(OUT / 'icon-512.png', optimize=True)
draw(512, safe=0.78).save(OUT / 'maskable-512.png', optimize=True)   # content inside the 80% safe circle
draw(180).save(OUT / 'apple-touch-icon-180.png', optimize=True)
print('icons written to', OUT)
