# Склейка: дорисовка (ESRGAN x4 -> высота 2048) + исходник, приведённый к высоте 2048, поверх 1:1.
# Переход 96 px только внутри исходника и только с той стороны, где была дорисовка.
# usage: comp.py GEN_X4.png SRC.webp GEOM.json OUT.png
import sys, json, numpy as np
from PIL import Image
GEN, SRC, GEOM, OUT = sys.argv[1:5]
import os
g = json.load(open(GEOM)); H, R = 2048, int(os.environ.get("R", 96))
gen = Image.open(GEN).convert('RGB'); W = round(gen.width * H / gen.height); gen = np.asarray(gen.resize((W, H), Image.LANCZOS), np.float32)
s = Image.open(SRC).convert('RGB'); WS = round(s.width * H / s.height); o8 = np.asarray(s.resize((WS, H), Image.LANCZOS)); o = o8.astype(np.float32)
X0 = round(g['nl'] * H / 1024); X0 = min(X0, W - WS)
x = np.arange(WS)
a = np.ones(WS, np.float32)
RL = int(os.environ.get("RL", R)); RR = int(os.environ.get("RR", R))
if g['nl'] > 0: a = np.minimum(a, np.clip(x / RL, 0, 1))
if g['nr'] > 0: a = np.minimum(a, np.clip((WS - 1 - x) / RR, 0, 1))
a = np.repeat(a[None, :], H, 0)
# широкий переход слева только в верхних строках (там только камень; рукав человека ниже — его полоса не задевает)
RLT = int(os.environ.get("RLTOP", 0)); TF = float(os.environ.get("TOPFRAC", 0))
if RLT and g['nl'] > 0:
    yy = np.arange(H)[:, None] / H
    wtop = np.clip((TF - yy) / 0.03, 0, 1)            # 1 вверху, 0 ниже TF (плавно за 3% высоты)
    aw = np.clip(x[None, :] / RLT, 0, 1)
    a = np.where(wtop > 0, np.minimum(a, aw * wtop + a * (1 - wtop)), a)
# справа ниже RHARD (доля высоты) край исходника — человек (низ худи): там без перехода, пиксели исходника 1:1
RH = float(os.environ.get("RHARD", 0))
if RH and g['nr'] > 0:
    # в этих строках исходник 1:1 только там, где человек: белое худи (яркое и ненасыщенное) с запасом 6px; камень за ним уходит в дорисовку
    from PIL import ImageFilter
    wm = ((o.mean(2) > 205) & ((o.max(2) - o.min(2)) < 30)).astype(np.uint8) * 255
    wm = np.asarray(Image.fromarray(wm).filter(ImageFilter.MaxFilter(13))) > 0
    r0 = int(RH * H)
    a[r0:, WS - RR:] = np.where(wm[r0:, WS - RR:], 1.0, a[r0:, WS - RR:])
    PERSON_HARD = wm[r0:, WS - RR:]
a = (a * a * (3 - 2 * a))[..., None]
res = gen.copy(); res[:, X0:X0 + WS] = o * a + gen[:, X0:X0 + WS] * (1 - a)
out = np.clip(res.round(), 0, 255).astype(np.uint8); Image.fromarray(out).save(OUT)
d = (out[:, X0:X0 + WS] != o8).any(2)
inner = d[int(TF * H) if RLT else 0:, (RL if g['nl'] else 0):WS - (RR if g['nr'] else 0)].sum(); top_wide = d[:int(TF * H), RL:RLT].sum() if RLT else 0
ph = int((d[int(RH * H):, WS - RR:] & PERSON_HARD).sum()) if RH else 0
print(f'худи в правой полосе: {int(PERSON_HARD.sum()) if RH else 0} px, из них изменено: {ph}')
print(f'{W}x{H}; исходник x={X0}..{X0+WS} (ширина {WS}); изменено пикселей исходника: всего {int(d.sum())}, вне полос перехода (слева {RL}px, справа {RR}px; сверху до {TF:.2f}H слева {RLT}px): {int(inner)}; в широкой верхней полосе: {int(top_wide)}')
