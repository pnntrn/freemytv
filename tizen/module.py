#!/usr/bin/env python3
"""Create a TizenBrew app-module archive. It is not an npm publication or a TV install."""
import json
from pathlib import Path
import sys
import zipfile
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import webapp

def build():
    package = {
        "name": "freemytv-surin", "version": "1.0.0",
        "description": "Free My TV with Thai Surin defaults and private CCTV",
        "license": "MIT", "private": True, "packageType": "app",
        "appName": "Free My TV Surin", "appPath": "app/index.html",
        "serviceFile": "service/nvr-service.js",
        "keys": ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "Info"],
    }
    target = ROOT / "FreeMyTV-tizenbrew.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as out:
        out.writestr("package.json", json.dumps(package, indent=2) + "\n")
        out.write(ROOT / "LICENSE", "LICENSE")
        codec = (ROOT / "tizen/nvr-codec.js").read_text(encoding="utf-8")
        service = (ROOT / "tizen/nvr-service.js").read_text(encoding="utf-8")
        bundled = "var NvrCodec = (function () { var module = {exports:{}};\n" + codec + "\nreturn module.exports; }());\n" + service
        out.writestr("service/nvr-service.js", bundled)
        for name, content in webapp.files(dict(webapp.GENERIC), "tizen/module.py").items():
            out.writestr("app/" + name, content)
    print("Built", target.name, "(module archive only; not published or installed)")
if __name__ == "__main__":
    build()
