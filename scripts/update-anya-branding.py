from PIL import Image
from pathlib import Path

src = Path(
    r"C:\Users\Shray\.cursor\projects\c-Users-Shray-Documents-anya\assets\c__Users_Shray_AppData_Roaming_Cursor_User_workspaceStorage_cf3d810451082f02f5f0308060091262_images_image-3e998490-d83a-4936-8dcc-53e2b8a89d59.png"
)
img = Image.open(src).convert("RGBA")
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
sq = img.crop((left, top, left + side, top + side))
out_dir = Path(r"C:\Users\Shray\Documents\anya")
master = sq.resize((512, 512), Image.Resampling.LANCZOS)
targets = [
    out_dir / "public" / "images" / "anya-logo.png",
    out_dir / "public" / "images" / "logo.png",
    out_dir / "public" / "icon.png",
    out_dir / "app" / "icon.png",
    out_dir / "app" / "apple-icon.png",
    out_dir / "public" / "images" / "anya-icon-test.png",
]
for target in targets:
    master.save(target, optimize=True)

sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
icons = [sq.resize(size, Image.Resampling.LANCZOS) for size in sizes]
icons[-1].save(out_dir / "public" / "favicon.ico", format="ICO", sizes=sizes)
print("favicon", (out_dir / "public" / "favicon.ico").stat().st_size)
print("icon", (out_dir / "public" / "icon.png").stat().st_size)
