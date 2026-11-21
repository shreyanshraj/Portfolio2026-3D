"""Renders the laptop loop: code being typed into a dark editor, 6 s, seamless.

    mkdir -p code-frames && python3 scripts/code-video.py
    ffmpeg -framerate 24 -i code-frames/f%03d.png -c:v libx264 -crf 24 -pix_fmt yuv420p \\
           -movflags +faststart -an public/media/laptop-loop.mp4
"""
import re
from PIL import Image, ImageDraw, ImageFont

W, H, S = 320, 200, 3
FPS, N = 24, 144                       # 6 seconds
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 9 * S)
OUT = 'code-frames'

# The code being typed: the function that picks this room's mood.
CODE = """export function phaseAt(date) {
  const h = date.getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h < 17) return 'day'
  if (h < 20) return 'evening'
  return 'night'
}

const room = await loadRoom()
room.light(phaseAt(new Date()))"""

BG, GUTTER, LINE_NO = (29, 34, 56), (24, 28, 47), (90, 100, 130)
COLORS = {'kw': (242, 193, 78), 'str': (169, 198, 140), 'num': (233, 162, 122), 'fn': (159, 180, 199), 'txt': (226, 230, 236)}
KEYWORDS = {'export', 'function', 'const', 'if', 'return', 'await', 'new'}

def tokens(line):
    for m in re.finditer(r"'[^']*'|\d+|[A-Za-z_]+|\s+|.", line):
        t = m.group(0)
        if t.startswith("'"): yield t, 'str'
        elif t.isdigit(): yield t, 'num'
        elif t in KEYWORDS: yield t, 'kw'
        elif re.match(r'[A-Za-z_]+$', t) and line[m.end():m.end() + 1] == '(': yield t, 'fn'
        else: yield t, 'txt'

total = len(CODE)
TYPE_FRAMES, HOLD = 110, 26            # type for ~4.6 s, hold ~1.1 s, then the loop restarts
lh, x0, y0 = 13 * S, 30 * S, 22 * S

for f in range(N):
    shown = total if f >= TYPE_FRAMES else int(total * f / TYPE_FRAMES)
    im = Image.new('RGB', (W * S, H * S), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W * S, 14 * S], fill=(20, 24, 40))                      # title bar
    for i, c in enumerate([(232, 87, 74), (242, 193, 78), (94, 160, 90)]):
        d.ellipse([(8 + i * 10) * S, 4 * S, (14 + i * 10) * S, 10 * S], fill=c)
    d.text((W * S // 2, 7 * S), 'room.js', font=FONT, fill=LINE_NO, anchor='mm')
    d.rectangle([0, 14 * S, 24 * S, H * S], fill=GUTTER)
    text = CODE[:shown]
    lines = text.split('\n')
    for n in range(len(CODE.split('\n'))):
        d.text((20 * S, y0 + n * lh), str(n + 1), font=FONT, fill=LINE_NO, anchor='ra')
    for n, line in enumerate(lines):
        x = x0
        for t, kind in tokens(line):
            d.text((x, y0 + n * lh), t, font=FONT, fill=COLORS[kind])
            x += d.textlength(t, font=FONT)
    if (f // 8) % 2 == 0 or f < TYPE_FRAMES:                                    # blinking caret
        cx = x0 + d.textlength(lines[-1], font=FONT)
        cy = y0 + (len(lines) - 1) * lh
        d.rectangle([cx + S, cy, cx + 2.5 * S, cy + 11 * S], fill=(242, 193, 78))
    # status bar
    d.rectangle([0, (H - 12) * S, W * S, H * S], fill=(94, 122, 90))
    d.text((6 * S, (H - 6) * S), 'main  ✓ build passing', font=FONT, fill=(247, 248, 245), anchor='lm')
    im.resize((W, H), Image.LANCZOS).save(f'{OUT}/f{f:03d}.png')
print('frames done')
