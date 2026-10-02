# Волна 3 (T015): выравнивание тона дорисованной стены к краю исходника (без нейросети), ДО склейки comp_w2.py.
# Для каждой строки — отношение цвета исходника к цвету дорисовки в одной и той же полосе у шва (внутри зоны перехода);
# поправка применяется к дорисовке и гаснет на FADE px от шва (smoothstep). Исходник не трогается — его вклеивает comp_w2.py.
# usage: tone_w3.py GEN_X4.png SRC.png GEOM.json OUT_GEN.png
import sys, json, numpy as np
from PIL import Image, ImageFilter
GEN, SRC, GEOM, OUT = sys.argv[1:5]
g = json.load(open(GEOM)); H, BAND, FADE = 2048, 24, 900
gen = Image.open(GEN).convert('RGB'); W = round(gen.width * H / gen.height); a = np.asarray(gen.resize((W, H), Image.LANCZOS), np.float32)
s = Image.open(SRC).convert('RGB'); WS = round(s.width * H / s.height); o = np.asarray(s.resize((WS, H), Image.LANCZOS), np.float32)
X0 = round(g['nl'] * H / 1024)
def rowmean(img, x0, x1):
    m = img[:, x0:x1].mean(1)
    return np.asarray(Image.fromarray(m[:, None, :].clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24)), np.float32)[:, 0]
out = a.copy()
for side, (b0, b1) in (('l', (24, 24 + BAND)), ('r', (WS - 44, WS - 20))):
    gain = (rowmean(o, b0, b1) + 1) / (rowmean(a, X0 + b0, X0 + b1) + 1)
    sat = rowmean(o, b0, b1); sat = sat.max(1) - sat.min(1)          # строки, где у края исходника не стена (шарик) — поправку берём от соседних строк стены
    ok = sat < 40; idx = np.arange(H)
    for c in range(3): gain[:, c] = np.interp(idx, idx[ok], gain[ok, c])
    gain = gain.clip(.85, 1.15)
    if side == 'l': xs = np.arange(0, X0 + 72); d = np.maximum(X0 + 72 - xs, 0)
    else: xs = np.arange(X0 + WS - 44, W); d = np.maximum(xs - (X0 + WS - 44), 0)
    t = np.clip(1 - d / FADE, 0, 1); t = t * t * (3 - 2 * t)
    out[:, xs] = a[:, xs] * (1 + (gain[:, None, :] - 1) * t[None, :, None])
    print(side, 'поправка у шва (R,G,B):', np.round(gain.mean(0), 3), 'мин/макс', np.round(gain.min(), 3), np.round(gain.max(), 3))
Image.fromarray(out.clip(0, 255).round().astype(np.uint8)).save(OUT); print('ok', OUT, W, H)
