# Правка правого края: отражение (серая толстовка) уходит в стекло плавно, без нейросети.
# Под правые FADE px исходника кладётся стекло (соседняя полоса стекла мастера, сдвинутая влево), вес исходника 1 -> 0 (smoothstep).
# Не трогаются: Валентина (белое худи — яркое и малонасыщенное; всё левее x=1100 исходника) и лицо/волосы отражения (красное/кожа).
# Тёмный шов 3px на месте старого жёсткого стыка заменяется стеклом.
# usage: refl_fade.py MASTER.png SRC.webp OUT.png
import sys, numpy as np
from PIL import Image, ImageFilter
M, SRC, OUT = sys.argv[1:4]
X0, WS, FADE = 3680, 1366, 240
X1 = X0 + WS
m = np.asarray(Image.open(M).convert('RGB'), np.float32)
o8 = np.asarray(Image.open(SRC).convert('RGB').resize((WS, 2048), Image.LANCZOS)); o = o8.astype(np.float32)
H = m.shape[0]
lum = o.mean(2); sat = o.max(2) - o.min(2)
# худи Валентины тёплое (R-B от 7 до 20, светлее 140), толстовка отражения нейтрально-серая (R-B≈0, ~140) — различаем по оттенку
white = (o[..., 0] - o[..., 2] >= 5) & (lum > 140) & (sat < 70)
# только крупные белые области (худи Валентины), мелкие блики отражения — нет: открытие 31px + возврат края 25px
wi = Image.fromarray((white * 255).astype(np.uint8))
big = np.asarray(wi.filter(ImageFilter.MinFilter(31)).filter(ImageFilter.MaxFilter(81)), np.uint8) > 0
white = white & big
face = (o[..., 0] - o[..., 2] > 45) & (o[..., 0] > 90)             # рыжие волосы, кожа, губы (Валентина и отражение)
kb = Image.fromarray(((white | face) * 255).astype(np.uint8))
keep_hard = np.asarray(kb.filter(ImageFilter.MaxFilter(7)), np.float32) / 255                       # маска + 3px — строго исходник
keep = np.maximum(keep_hard, np.asarray(kb.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255)
keep[:, :1100] = 1.0
x = np.arange(WS)[None, :]
t = np.clip((WS - 1 - x) / FADE, 0, 1); w = t * t * (3 - 2 * t)      # 1 внутри, 0 у края
w = np.maximum(w, keep)
pm = (lum > 150) | ((o[..., 0] > 140) & (o[..., 0] - o[..., 2] > 60))
pm = np.asarray(Image.fromarray((pm * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(9))) > 0
w = np.where((pm & (x < 1100)) | white, 1.0, w)                          # пиксели Валентины — всегда исходник
glass = m[:, X1 + 12:X1 + 12 + FADE]                               # стекло сразу за стыком (уже без шва)
res = m.copy()
a = X1 - FADE; wf = w[:, WS - FADE:, None]
res[:, a:X1] = m[:, a:X1] * wf + glass * (1 - wf)                      # меняется только правая полоса FADE px
res[:, X1:X1 + 3] = m[:, X1 + 12:X1 + 15]                            # убрать старый тёмный шов (за краем исходника)
out = np.clip(res.round(), 0, 255).astype(np.uint8)
Image.fromarray(out).save(OUT)
chg = (out[:, X0:X1] != o8).any(2)
m8 = np.clip(m.round(), 0, 255).astype(np.uint8)
dm = (out != m8).any(2)
person = (lum > 150) | ((o[..., 0] > 140) & (o[..., 0] - o[..., 2] > 60))
person = np.asarray(Image.fromarray((person * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(9))) > 0
val = (person & (x < 1100)) | white                                   # Валентина: белое худи + всё её левее отражения
cols = np.where(dm.any(0))[0]
print(f'изменено относительно прошлого мастера: колонки {cols.min()}..{cols.max()} (полоса стыка X1-{FADE}..X1+2 = {X1-FADE}..{X1+2}), px={int(dm.sum())}')
print(f'Валентина px={int(val.sum())}; отличий от исходника={int((chg & val).sum())}')