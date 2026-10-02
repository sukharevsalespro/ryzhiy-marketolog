# Волна 3 (T015): апскейл и склейка дорисовки portrait-mic; на NVR, в /tmp/w3-sd.  usage: post_w3.sh SEED
# Справа дорисовка покрывает только 48 px (2048) под исходником: переход справа RR=40, иначе в полосу перехода попадает пустая (чёрная) зона холста op_w3 — это был тёмный вертикальный шов первой склейки.
set -e
cd /tmp/w3-sd; s=$1
mkdir -p up fin
printf "/tmp/w3-sd/mic2/half-s$s.png\tx4-mic-s$s.png\n" > up-mic.tsv
[ -f up/x4-mic-s$s.png ] || ~/gpu-test/venv/bin/python ~/gpu-test/upscale/upscale_batch.py up-mic.tsv /tmp/w3-sd/up | tail -1
~/gpu-test/venv/bin/python tone_w3.py up/x4-mic-s$s.png src/mic.png mic2/geom.json up/tone-mic-s$s.png
RL=72 RR=40 R=${R:-72} ~/gpu-test/venv/bin/python comp_w2.py up/tone-mic-s$s.png src/mic.png mic2/geom.json fin/zb-wide-s$s-master.png
~/gpu-test/venv/bin/python - "$s" <<'PY'
import sys; from PIL import Image
s=sys.argv[1]; im=Image.open(f'/tmp/w3-sd/fin/zb-wide-s{s}-master.png'); print('master',im.size)
for h in (1080,1440,2048):
    w=round(im.width*h/im.height); im.resize((w,h),Image.LANCZOS).save(f'/tmp/w3-sd/fin/zb-wide-s{s}-{h}.webp',quality=86,method=6); print(h,w)
PY
