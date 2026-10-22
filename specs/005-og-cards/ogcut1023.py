# Вырезы для OG (23.10.2026) тем же рецептом, что ogl_a2/ogl_b2/ogl_c2 (talks/ogsrc): BiRefNet-portrait + segformer
# face-parsing (лицо, уши, серьги, очки) + поджатие края тела, мягкий край волос, деконтаминация pymatting.
# Пиксели фото не меняются: только кроп рабочего кадра и альфа. venv /srv/work/neurophoto/venv,
# U2NET_HOME=$HOME/.rembg/models/birefnet-portrait. Выход: cut/og-<имя>.webp высотой 1500 px.
import os, sys, numpy as np, torch
from PIL import Image, ImageFilter
from rembg import new_session, remove
from pymatting import estimate_foreground_ml
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation
SRC = '/srv/work/rm-talks-1023/ogsrc'
os.chdir('/srv/work/rm-talks-1023'); os.makedirs('ogcut', exist_ok=True)
JOBS = {  # имя выреза: (исходник, кроп x0,y0,x1,y1 — низ кропа по краю стола/кадра)
    'raspakovka-game-host': ('N14-raspakovka.jpg', (200, 0, 1620, 1790)),
    'rv-n15': ('N15-razvitie-mobile.png', (0, 0, 1330, 1815)),
    'nf-velvet-l1': ('L1.jpg', (0, 0, 1792, 2400)),
    'nf-silk-l4': ('L4.jpg', (0, 0, 1792, 2400)),
}
only = sys.argv[1:] or list(JOBS)
sess = new_session('birefnet-portrait')
proc = SegformerImageProcessor.from_pretrained('jonathandinu/face-parsing')
model = SegformerForSemanticSegmentation.from_pretrained('jonathandinu/face-parsing').cuda().eval()
for n in only:
    f, box = JOBS[n]
    work = Image.open(f'{SRC}/{f}').convert('RGB').crop(box); W, H = work.size
    a = np.asarray(remove(work, session=sess, only_mask=True), np.float32) / 255
    ys, xs = np.where(a > .5); top = ys.min(); S = min(1500, W, H)
    cx = (xs[ys < top + 1000].min() + xs[ys < top + 1000].max()) // 2
    bx = int(np.clip(cx - S // 2, 0, W - S)); by = int(max(0, top - 60))
    crop = work.crop((bx, by, bx + S, by + S))
    with torch.no_grad():
        out = model(**proc(images=crop, return_tensors='pt').to('cuda')).logits
        lab = torch.nn.functional.interpolate(out, size=(S, S), mode='bilinear', align_corners=False).argmax(1)[0].cpu().numpy().astype(np.uint8)
    full = np.zeros((H, W), np.uint8); hh = min(S, H - by); full[by:by + hh, bx:bx + S] = lab[:hh]
    face = np.isin(full, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17]); hair = full == 13
    face_s = np.asarray(Image.fromarray((face * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    a = np.maximum(a, face_s)
    core = np.asarray(Image.fromarray((a > .5).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(.8)), np.float32) / 255
    hz = np.asarray(Image.fromarray((hair * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(21)), np.float32) / 255 > .5
    a2 = np.where(hz, a, np.minimum(a, core))
    fg = estimate_foreground_ml(np.asarray(work, np.float64) / 255, a2.astype(np.float64))
    cut = Image.fromarray(np.dstack([np.clip(fg * 255, 0, 255), a2 * 255]).astype(np.uint8), 'RGBA')
    bb = cut.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox(); cut = cut.crop((bb[0], bb[1], bb[2], cut.height))
    s = 1500 / cut.height; cut = cut.resize((round(cut.width * s), 1500), Image.LANCZOS)
    cut.save(f'ogcut/og-{n}.webp', 'WEBP', quality=92, method=6)
    # контроль: вырез на графите и на рыжем
    for bg, nm in [((38, 40, 45), 'g'), ((254, 108, 31), 'o')]:
        c = Image.new('RGBA', cut.size, bg + (255,)); c.alpha_composite(cut); c.convert('RGB').save(f'ogcut/qc-{n}-{nm}.jpg', quality=88)
    print(n, 'work', work.size, 'bbox', bb, 'cut', cut.size, 'face px', int(face.sum()), 'hair px', int(hair.sum()), flush=True)
