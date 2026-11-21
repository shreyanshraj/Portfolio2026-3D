"""Renders the TV loop: a little desert racing game, 4 s, seamless.

    mkdir -p frames && python3 scripts/tv-video.py
    ffmpeg -framerate 24 -i frames/f%03d.png -c:v libx264 -crf 26 -pix_fmt yuv420p \
           -movflags +faststart -an public/media/tv-loop.mp4
"""
import math
from PIL import Image, ImageDraw

W, H, S = 384, 200, 2          # output size, supersample factor
FR, N = 24, 96                 # 24 fps, 96 frames = 4 s
w, h = W * S, H * S
HORIZON = int(h * 0.56)

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))

SKY0, SKY1 = hexc('#6FA9CF'), hexc('#F5D9A8')
SUN = hexc('#F2C14E')
FAR, MID = hexc('#B98A86'), hexc('#8E6C73')
SAND, ROAD, LINE = hexc('#D9B98C'), hexc('#2E3550'), hexc('#F7F8F5')
CACTUS = hexc('#4F6B4C')
CAR, CAR2, GLASS, TYRE = hexc('#E8574A'), hexc('#B8403A'), hexc('#9FB4C7'), hexc('#1D2238')

def ridge(period, amp, base, phase_px, seed):
    # sum of sines whose periods divide `period` -> tiles seamlessly
    pts = []
    for x in range(0, w + 8, 8):
        u = (x + phase_px) / period * 2 * math.pi
        y = base - amp * (0.55 * math.sin(u + seed) + 0.3 * math.sin(2 * u + seed * 2) + 0.15 * math.sin(5 * u + seed))
        pts.append((x, y))
    return pts + [(w, h), (0, h)]

def saguaro(d, x, ground, s):
    d.rounded_rectangle([x, ground - 46 * s, x + 9 * s, ground], radius=int(4 * s), fill=CACTUS)
    d.rounded_rectangle([x - 9 * s, ground - 34 * s, x - 3 * s, ground - 16 * s], radius=int(3 * s), fill=CACTUS)
    d.rectangle([x - 9 * s, ground - 20 * s, x + 2 * s, ground - 15 * s], fill=CACTUS)
    d.rounded_rectangle([x + 12 * s, ground - 40 * s, x + 18 * s, ground - 24 * s], radius=int(3 * s), fill=CACTUS)
    d.rectangle([x + 6 * s, ground - 28 * s, x + 18 * s, ground - 23 * s], fill=CACTUS)

for f in range(N):
    t = f / N
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(HORIZON + 40 * S):
        d.line([(0, y), (w, y)], fill=lerp(SKY0, SKY1, min(1, y / HORIZON)))
    d.ellipse([w * 0.7, HORIZON * 0.35, w * 0.7 + 70 * S, HORIZON * 0.35 + 70 * S], fill=SUN)
    d.polygon(ridge(w, 22 * S, HORIZON - 6 * S, t * w, 1.3), fill=FAR)                 # 1 period / loop
    d.polygon(ridge(w / 2, 14 * S, HORIZON + 8 * S, t * w, 0.4), fill=MID)             # 2 periods / loop
    d.rectangle([0, HORIZON + 8 * S, w, h], fill=SAND)
    # saguaros on the roadside, 3 per screen, scroll one screen per loop x3
    period = w / 3
    off = (t * w * 3) % period
    for i in range(-1, 4):
        saguaro(d, i * period - off + 40 * S, HORIZON + 34 * S, S * 0.9)
    # road
    top = HORIZON + 44 * S
    d.rectangle([0, top, w, h], fill=ROAD)
    d.rectangle([0, top, w, top + 3 * S], fill=hexc('#4A5170'))
    dash = 64 * S
    off = (t * dash * 24) % dash
    yl = top + (h - top) // 2
    for i in range(-1, w // dash + 2):
        x = i * dash - off
        d.rectangle([x, yl - 2 * S, x + dash * 0.5, yl + 2 * S], fill=LINE)
    # car, gently bobbing (8 bobs per loop)
    bob = math.sin(t * 2 * math.pi * 8) * 1.5 * S
    cx, cy = 92 * S, yl - 4 * S + bob
    d.ellipse([cx - 4 * S, cy + 12 * S, cx + 76 * S, cy + 20 * S], fill=hexc('#1D2238'))
    d.rounded_rectangle([cx, cy - 10 * S, cx + 72 * S, cy + 12 * S], radius=8 * S, fill=CAR)
    d.rounded_rectangle([cx + 16 * S, cy - 24 * S, cx + 52 * S, cy - 6 * S], radius=6 * S, fill=CAR2)
    d.rounded_rectangle([cx + 20 * S, cy - 21 * S, cx + 48 * S, cy - 9 * S], radius=4 * S, fill=GLASS)
    d.rectangle([cx, cy, cx + 72 * S, cy + 3 * S], fill=CAR2)
    for wx in (cx + 14 * S, cx + 58 * S):
        d.ellipse([wx - 9 * S, cy + 3 * S, wx + 9 * S, cy + 21 * S], fill=TYRE)
        spin = t * 2 * math.pi * 12
        d.line([(wx, cy + 12 * S), (wx + 6 * S * math.cos(spin), cy + 12 * S + 6 * S * math.sin(spin))], fill=hexc('#9AA1AC'), width=2 * S)
    # speed lines
    for i in range(5):
        y = cy - 6 * S + i * 5 * S
        x0 = (cx - 20 * S - ((t * 40 + i * 7) % 1) * 60 * S)
        d.line([(x0, y), (x0 + 18 * S, y)], fill=hexc('#F7F8F5'), width=S)
    im.resize((W, H), Image.LANCZOS).save(f'frames/f{f:03d}.png')
print('frames done')
