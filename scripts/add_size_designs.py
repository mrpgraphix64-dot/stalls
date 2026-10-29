"""Process size-specific stall images (e.g. images/3x3 design (2)/3x3 design) into
WebP optimized + thumbnail files with the Reworkzone watermark. Run from the project root:
    python scripts/add_size_designs.py
Prints nothing to the data files; entries live in src/data/projectsData.ts."""
import os
import re
from PIL import Image, ImageOps

SRC = os.path.join('images', '3x3 design (2)', '3x3 design')
OUTS = [os.path.join('public', 'images'), 'images']
wm = Image.open(os.path.join('public', 'watermark.png')).convert('RGBA')


def watermark(im, ratio=0.22, opacity=0.78):
    base = im.convert('RGBA')
    w, h = base.size
    d = max(90, int(min(w, h) * ratio))
    m = wm.resize((d, d), Image.LANCZOS)
    r, g, b, a = m.split()
    m.putalpha(a.point(lambda p: int(p * opacity)))
    margin = max(12, int(min(w, h) * 0.035))
    base.paste(m, (w - d - margin, h - d - margin), m)
    return base.convert('RGB')


def resize(im, limit):
    w, h = im.size
    if max(w, h) <= limit:
        return im
    s = limit / max(w, h)
    return im.resize((int(w * s), int(h * s)), Image.LANCZOS)


for f in sorted(os.listdir(SRC)):
    if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
        continue
    clean = re.sub(r'[^A-Za-z0-9]+', '_', os.path.splitext(f)[0]).strip('_') + '.webp'
    with Image.open(os.path.join(SRC, f)) as raw:
        im = ImageOps.exif_transpose(raw).convert('RGB')
    opt = watermark(resize(im, 1920))
    thumb = resize(im, 720)
    for out in OUTS:
        for sub, img, q in (('optimized', opt, 85), ('thumbs', thumb, 80)):
            os.makedirs(os.path.join(out, sub), exist_ok=True)
            img.save(os.path.join(out, sub, clean), 'WEBP', quality=q, method=4)
    print(f"{f} -> {clean} full={opt.size} thumb={thumb.size}")
