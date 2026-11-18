"""Create static weight instances of the supplied Hanken Grotesk variable font.

React Native on Android cannot select weights from a variable TTF, so the native
specimen bundles static instances generated from the *supplied* file
(assets/fonts/hanken-grotesk/HankenGrotesk-Variable.ttf). Same design, no
substitution. SIL OFL 1.1; the font has no Reserved Font Name.

Usage (from workspace root):
  python3 design-lab/scripts/instance_hanken.py \
      assets/fonts/hanken-grotesk/HankenGrotesk-Variable.ttf design-lab/mobile/assets/fonts
Requires fontTools (tested with 4.67.0).
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

WEIGHTS = {"Regular": 400, "Medium": 500, "SemiBold": 600, "Bold": 700}

def main(src: str, out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, wght in WEIGHTS.items():
        font = TTFont(src)
        inst = instantiateVariableFont(font, {"wght": wght}, updateFontNames=False)
        names = inst["name"]
        for rec in list(names.names):
            if rec.nameID in (1, 16):
                names.setName(f"Hanken Grotesk {name}", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
            elif rec.nameID in (2, 17):
                names.setName("Regular", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
            elif rec.nameID == 4:
                names.setName(f"Hanken Grotesk {name}", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
            elif rec.nameID == 6:
                names.setName(f"HankenGrotesk-{name}", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        inst["OS/2"].usWeightClass = wght
        path = out / f"HankenGrotesk-{name}.ttf"
        inst.save(path)
        print(path)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
