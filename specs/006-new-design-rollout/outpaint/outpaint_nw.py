# Дорисовка фона portrait-phone-call в горизонталь ~32:9 (SDXL inpainting 0.1, NVR). Масштаб генерации: высота 1024.
# Слева +NEW_L, справа +NEW_R. Человек не перерисовывается: в маске только новая область + 32px стыка;
# в финале (compose_nw.py) исходные пиксели вклеиваются поверх один в один.
# usage: outpaint_nw.py SRC.webp OUTDIR "seed,seed,..."
import sys, os, torch
from PIL import Image, ImageFilter, ImageOps
import numpy as np
from diffusers import StableDiffusionXLInpaintPipeline, AutoencoderKL
SRC, OUT, SEEDS = sys.argv[1], sys.argv[2], [int(s) for s in sys.argv[3].split(',')]
STR = float(sys.argv[4]) if len(sys.argv) > 4 else 0.8
STR_R = float(sys.argv[5]) if len(sys.argv) > 5 else 0.45
H, WS = 1024, 683
NEW_L, NEW_R, OV = 1840, 1120, 72
CTX_L, CTX_R = 168, 96  # контекст без волос и лиц: слева только рукав/фон, справа только край стекла/отражения
os.makedirs(OUT, exist_ok=True)
vae = AutoencoderKL.from_pretrained('/tmp/sdo/m/vae', torch_dtype=torch.float16)
pipe = StableDiffusionXLInpaintPipeline.from_pretrained('/tmp/sdo/m/sdxl', vae=vae, torch_dtype=torch.float16, variant='fp16')
pipe.enable_model_cpu_offload()
src = Image.open(SRC).convert('RGB').resize((WS, H), Image.LANCZOS)
PL = ('photo background, low key, deep navy blue sky, dark silhouettes of bare tree branches, heavily out of focus, '
      'strong bokeh, shallow depth of field f1.4, dark blue tones, cinematic, photorealistic')
PR = ('photo background, low key, dark navy blue reflective glass wall, almost uniform deep blue, one thin vertical seam, '
      'soft blurred reflections, shallow depth of field, cinematic, photorealistic')
N = ('person, people, woman, man, face, head, hands, fingers, arm, body, second person, text, letters, watermark, logo, '
     'cartoon, painting, lowres, deformed, frame, border, building, buildings, windows, towers, sharp details, bright, white, beige, pink, orange, red, brick, ground, street, autumn, foliage, leaves, flowers, reflection of a person')

def side(seed, left):
    if not left: pass
    new = NEW_L if left else NEW_R
    CTX = CTX_L if left else CTX_R
    W = new + CTX
    ctx = src.crop((0, 0, CTX, H)) if left else src.crop((WS - CTX, 0, WS, H))
    # префилл: цвета фона у края без людей (светлые пиксели рукава/отражения заменены средним фоном строки), размыто
    a = np.asarray(ctx, np.float32); lum = a.mean(2); bright = (lum > 110)
    rowbg = np.array([a[y][~bright[y]].mean(0) if (~bright[y]).sum() > 8 else np.array([12, 18, 40.]) for y in range(H)])
    a[bright] = rowbg[np.nonzero(bright)[0]]
    base = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(30))
    fill = Image.new('RGB', (W, H)); x = 0; flip = True
    while x < W:
        fill.paste(ImageOps.mirror(base) if flip else base, (x, 0)); x += base.width; flip = not flip
    fill = fill.filter(ImageFilter.GaussianBlur(20))
    if not left:
        # стекло справа — синтетика: построчный цвет стекла (верх кадра у правого края) с затемнением книзу,
        # у стыка ~120px продолжение отражения (зеркало края), вертикальный шов панели, зерно
        glass = np.asarray(src.crop((WS - 110, 0, WS - 10, 330)), np.float32).reshape(-1, 3)
        top = np.asarray(src.crop((WS - 110, 0, WS - 10, 40)), np.float32).mean((0, 1))
        mid = np.median(glass, 0); bot = np.array([8, 14, 32], np.float32)
        t = np.linspace(0, 1, H)[:, None]
        col = np.where(t < .35, top + (mid - top) * (t / .35), mid + (bot - mid) * ((t - .35) / .65))
        syn = np.repeat(col[:, None, :], W, 1)
        rng = np.random.default_rng(seed); syn += rng.normal(0, 3.0, syn.shape)
        sx = CTX + 520; syn[:, sx:sx + 2] *= 0.55
        f = Image.fromarray(np.clip(syn, 0, 255).astype(np.uint8))
        f.paste(ctx, (0, 0)); fill = f
    fill.paste(ctx, (new, 0) if left else (0, 0))
    mask = Image.new('L', (W, H), 0)
    mask.paste(255, (0, 0, new + OV, H) if left else (CTX - OV, 0, W, H))
    mask = mask.filter(ImageFilter.GaussianBlur(12))
    g = torch.Generator('cuda').manual_seed(seed + (0 if left else 1000))
    out = pipe(prompt=PL if left else PR, negative_prompt=N, image=fill, mask_image=mask, width=W, height=H,
               strength=(STR if left else STR_R), num_inference_steps=40, guidance_scale=5.0, generator=g).images[0]
    return out

# v5: генерируется только левая часть; окно сохраняется целиком (новая область + CTX_L исходника, из них OV перерисовано
# моделью) — чтобы в склейке переход шёл по перерисованной полосе, а не по краю. Правая часть (стекло) строится в склейке.
for seed in SEEDS:
    side(seed, True).save(f'{OUT}/winL-s{seed}.png'); print('done', seed, flush=True)
