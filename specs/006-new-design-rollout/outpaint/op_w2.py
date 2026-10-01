# Волна 2 (01.10.2026): дорисовка фона под первый экран посадочных; запуск на NVR: PYTHONPATH=/tmp/sdo/pk ~/gpu-test/venv/bin/python op_w2.py job-w2-*.json
# Дорисовка фона до ~32:9 по бокам (SDXL inpainting 0.1, GPU NVR), высота генерации 1024. Человек не перерисовывается:
# маска — только новая область + OV px стыка; исходник в склейке вклеивается поверх 1:1.
# usage: op.py JOB.json   (src, out, new_l, new_r, ctx_l, ctx_r, prompt_l, prompt_r, seeds, strength)
import sys, os, json, torch, numpy as np
from PIL import Image, ImageFilter, ImageOps
from diffusers import StableDiffusionXLInpaintPipeline, AutoencoderKL
J = json.load(open(sys.argv[1])); H, OV = 1024, 64
os.makedirs(J['out'], exist_ok=True)
vae = AutoencoderKL.from_pretrained('/tmp/sdo/m/vae', torch_dtype=torch.float16)
pipe = StableDiffusionXLInpaintPipeline.from_pretrained('/tmp/sdo/m/sdxl', vae=vae, torch_dtype=torch.float16, variant='fp16')
pipe.enable_model_cpu_offload()
src = Image.open(J['src']).convert('RGB'); WS = round(src.width * H / src.height); src = src.resize((WS, H), Image.LANCZOS)
N = ('person, people, woman, man, face, head, hands, fingers, arm, legs, body, text, letters, watermark, logo, '
     'cartoon, painting, lowres, deformed, frame, border, collage, split screen')
def side(seed, left):
    new = J['new_l'] if left else J['new_r']
    if new <= 0: return None
    ctx_w = J['ctx_l'] if left else J['ctx_r']; W = new + ctx_w; W -= W % 8; new = W - ctx_w
    ctx = src.crop((0, 0, ctx_w, H)) if left else src.crop((WS - ctx_w, 0, WS, H))
    base = ctx if J.get('prefill') == 'mirror' else ctx.filter(ImageFilter.GaussianBlur(28))
    fill = Image.new('RGB', (W, H)); x = 0; flip = True
    while x < W:
        fill.paste(ImageOps.mirror(base) if flip else base, (x, 0)); x += base.width; flip = not flip
    if J.get('prefill') != 'mirror': fill = fill.filter(ImageFilter.GaussianBlur(24))
    fill.paste(ctx, (new, 0) if left else (0, 0))
    mask = Image.new('L', (W, H), 0)
    mask.paste(255, (0, 0, new + OV, H) if left else (ctx_w - OV, 0, W, H))
    mask = mask.filter(ImageFilter.GaussianBlur(12))
    g = torch.Generator('cuda').manual_seed(seed + (0 if left else 1000))
    out = pipe(prompt=J['prompt_l' if left else 'prompt_r'], negative_prompt=N + ', ' + J.get('neg', ''), image=fill, mask_image=mask,
               width=W, height=H, strength=J['strength'], num_inference_steps=40, guidance_scale=5.5, generator=g).images[0]
    return out, new, ctx_w
for seed in J['seeds']:
    l, r = side(seed, True), side(seed, False)
    nl = l[1] if l else 0; nr = r[1] if r else 0
    can = Image.new('RGB', (nl + WS + nr, H))
    if l: can.paste(l[0].crop((0, 0, nl + l[2], H)), (0, 0))
    if r: can.paste(r[0], (nl + WS - r[2], 0))
    can.paste(src.crop((OV + 16 if l else 0, 0, WS - (OV + 16 if r else 0), H)), (nl + (OV + 16 if l else 0), 0))  # центр исходника поверх (кроме полос стыка)
    can.save(f"{J['out']}/half-s{seed}.png"); json.dump({'nl': nl, 'ws': WS, 'nr': nr}, open(f"{J['out']}/geom.json", 'w'))
    print('done', seed, can.size, 'nl', nl, 'ws', WS, 'nr', nr, flush=True)
