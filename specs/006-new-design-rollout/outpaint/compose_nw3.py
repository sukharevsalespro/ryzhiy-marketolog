# Склейка v3 (итоговая): холст 7286x2048 ≈ 32:9.
#  слева  — дорисовка SDXL (окно ESRGAN x4 -> высота 2048), переход в исходник по полосе, которую модель перерисовала (144px);
#  центр  — исходник portrait-phone-call-2400 (к высоте 2048), пиксели человека не трогаются никогда (маска + 8px);
#  справа — стеклянная стена синтетикой из цветов стекла самого исходника (построчно), шумы как у плёнки, стыки панелей.
# usage: compose_nw3.py WIN_X4.png SRC.webp OUT.png
import sys, numpy as np
from PIL import Image, ImageFilter
WIN, SRC, OUT = sys.argv[1:4]
H, X0, WSRC, WR, BL = 2048, 3680, 1366, 2240, 144
W = X0 + WSRC + WR; X1 = X0 + WSRC
win = Image.open(WIN).convert('RGB'); win = np.asarray(win.resize((round(win.width * H / win.height), H), Image.LANCZOS), np.float32)
o = np.asarray(Image.open(SRC).convert('RGB').resize((WSRC, H), Image.LANCZOS), np.float32)
lum = o.mean(2); R, B = o[..., 0], o[..., 2]
person = (lum > 150) | ((R > 140) & (R - B > 60))
person = np.asarray(Image.fromarray((person * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(9))) > 0
keep = np.asarray(Image.fromarray((person * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17))) > 0  # человек + 8px — строго исходник
keep_soft = np.asarray(Image.fromarray((person * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(33)).filter(ImageFilter.GaussianBlur(22)), np.float32) / 255
keep_soft = np.clip(keep_soft * 2, 0, 1)  # мягкий ореол вокруг человека: без жёсткой кромки между фоном исходника и дорисовкой
res = np.zeros((H, W, 3), np.float32)
res[:, :win.shape[1]] = win
# левый переход: вес исходника 0 -> 1 на первых BL px исходника (там модель рисовала поверх контекста); человек — всегда 1
x = np.arange(WSRC)[None, :]
aL = np.clip(x / BL, 0, 1); aL = aL * aL * (3 - 2 * aL)
# стекло справа: построчный медианный цвет стекла у правого края исходника (без человека/отражения)
band = o[:, WSRC - 420:]
# стекло = синий доминирует (волосы/кожа/серое худи отражения сюда не попадают)
glassm = (o[..., 2] > o[..., 0] * 1.6 + 4) & (o[..., 2] > o[..., 1] * 1.08) & (lum < 140)
glassm = np.asarray(Image.fromarray((glassm * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))) > 0
bm = glassm[:, WSRC - 420:]
rows = np.full((H, 3), np.nan, np.float32)
for y in range(H):
    m = bm[y]
    if m.sum() > 30: rows[y] = np.median(band[y][m], 0)
ok = ~np.isnan(rows[:, 0]); ys = np.arange(H)
last = ys[ok].max()
# гладкая модель цвета стекла по высоте: квадратичная аппроксимация по строкам со стеклом; ниже — мягко темнее (×0.65 к низу)
fit = np.stack([np.polyval(np.polyfit(ys[ok], rows[ok, c], 2), ys) for c in range(3)], 1)
fit = np.clip(fit, 0, 255)
fit[last:] = fit[last]  # ниже последней строки стекла модель не экстраполируется (иначе уходит в красный)
t = np.clip((ys - last) / max(H - last, 1), 0, 1)[:, None]
rows = fit * (1 - 0.4 * t * t * (3 - 2 * t))
rng = np.random.default_rng(7)
lf = np.asarray(Image.fromarray((rng.random((H // 64, WR // 64)) * 255).astype(np.uint8)).resize((WR, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(60)), np.float32) / 255 - .5
glass = rows[:, None, :] * (1 + lf[..., None] * 0.10) * (1 - 0.10 * (np.arange(WR) / WR))[None, :, None]
glass += rng.normal(0, 2.2, glass.shape)
res[:, X1:] = glass
# правый переход: по строкам, где у края стекло (вес исходника 1 -> 0 на последних 200px), где отражение — жёстко
aR = np.ones((H, WSRC), np.float32)
dr = np.array([np.flatnonzero(~glassm[y][::-1])[0] if (~glassm[y]).any() else WSRC for y in range(H)])  # до первого не-стекла от края
wr = np.clip(dr - 16, 0, 200); wr = np.array([wr[max(0, y - 40):y + 41].min() for y in range(H)])
xr = (WSRC - 1 - np.arange(WSRC))[None, :]
aR = np.where(wr[:, None] > 0, np.clip(xr / np.maximum(wr[:, None], 1), 0, 1), 1.0)
under = res[:, X0:X1].copy()
under[:, WSRC - 200:] = np.where((xr[:, WSRC - 200:] < 200)[..., None], rows[:, None, :] * np.ones((1, 200, 1)), under[:, WSRC - 200:])
a = np.minimum(aL, aR); a = np.where(aR > 0.999, np.maximum(a, keep_soft), a); a = np.where(keep & ((aR > 0.999) | (x < WSRC - 220)), 1.0, a)[..., None]
res[:, X0:X1] = o * a + under * (1 - a)
# стыки панелей: исходный шов в кадре на ~854px от левого края исходника, шаг панелей ~1000px
def seam(xc, strength):
    for dx, f in ((-2, .8), (-1, .62), (0, .55), (1, .62), (2, .8)):
        c = xc + dx
        if 0 <= c < W: res[:, c] *= (1 - (1 - f) * strength)
hard = np.asarray(Image.fromarray(((wr < 24)[:, None] * 255).astype(np.uint8).repeat(4, 1)).filter(ImageFilter.GaussianBlur(30)), np.float32)[:, 0] / 255
for dx, f in ((-2, .7), (-1, .5), (0, .45), (1, .5), (2, .7)):
    res[:, X1 + dx] *= (1 - hard[:, None] * (1 - f))
for xc in (X0 + 854 + 1000, X0 + 854 + 2000, X0 + 854 + 3000):
    if xc > X1 + 4: seam(xc, 1.0)
out = np.clip(res.round(), 0, 255).astype(np.uint8)
Image.fromarray(out).save(OUT)
src8 = np.clip(o.round(), 0, 255).astype(np.uint8)
chg = (out[:, X0:X1] != src8).any(2)
print(f'{W}x{H}; src x={X0}..{X1}; changed src px={int(chg.sum())}/{chg.size}; person px={int(person.sum())}, changed person px={int((chg & person).sum())}, '
      f'of them in right 3px seam over reflection={int((chg & person)[:, WSRC-3:].sum())}; glass rows found={int(ok.sum())}')
