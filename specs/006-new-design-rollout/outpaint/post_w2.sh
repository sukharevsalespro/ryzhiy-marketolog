# usage: post.sh name seed outname   (на NVR, в /tmp/w2b)
set -e
cd /tmp/w2b; n=$1; s=$2; o=$3
mkdir -p up fin
printf "/tmp/w2b/$n/half-s$s.png\tx4-$n-s$s.png\n" > up-$n.tsv
~/gpu-test/venv/bin/python ~/gpu-test/upscale/upscale_batch.py up-$n.tsv /tmp/w2b/up | tail -1
R=${R:-96} ~/gpu-test/venv/bin/python comp_w2.py up/x4-$n-s$s.png src/$n.png $n/geom.json fin/$o-master.png
~/gpu-test/venv/bin/python - "$o" <<'PY'
import sys; from PIL import Image
o=sys.argv[1]; im=Image.open(f'/tmp/w2b/fin/{o}-master.png'); print('master',im.size)
for h in (1080,1440,2048):
    w=round(im.width*h/im.height); im.resize((w,h),Image.LANCZOS).save(f'/tmp/w2b/fin/{o}-{h}.webp',quality=86,method=6); print(o,h,w)
PY
