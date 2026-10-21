# Free My TV Surin — experimental build

Thai/Sarabun, Mueang Surin weather, streaming-app shortcuts, configurable settings key,
private CCTV profiles and 1/4/9/12/16/custom camera layouts. Original MIT license retained.
Build tests do not verify TV/NVR operation. No TV, NVR or VPN was connected.

## Downloads and installation

- **FreeMyTV-test.apk**: Android TV 9+ test installation. Temporary signing key; later
  builds may require uninstalling, which erases saved settings and NVR credentials.
  If persistent signing secrets are configured, **FreeMyTV.apk** is supplied instead.
  BUILD_INFO.txt records the signing mode and certificate fingerprint.
- **FreeMyTV-tizen.wgt**: separate Samsung web app, **unsigned**. Tizen cannot run the APK.
  TizenBrew Installer's Install from GitHub input is `pnntrn/freemytv`.
  Its source selects the WGT from the latest release and re-signs only on Tizen 7+.
  On older TVs it attempts installation without re-signing; acceptance of this unsigned
  build is unverified. If rejected for signatures, local Samsung certificate signing is
  required. No signing keys are included. Updates need the same signing identity.
- **FreeMyTV-tizenbrew.zip**: optional TizenBrew runtime module archive; not a WGT
  and not published to npm. Module installation has not been tested.
- **SHA256SUMS**, **BUILD_INFO.txt**, **LICENSE**: integrity, build and license details.

Android: enable debugging and accept the TV prompt, then use
`adb connect TV_IP:5555` and `adb install -r FreeMyTV-test.apk` (adjust filename if needed).
Test before changing the default launcher. Official streaming apps must be installed
separately from the TV's store and require their own accounts.

Samsung: use [TizenBrew Installer](https://github.com/reisxd/TizenBrewInstaller/releases/latest)
on your computer, connect to the TV, and select Install from GitHub: `pnntrn/freemytv`.
Developer Mode and the SDB connection must work first. This provides the expected release
asset; installation and signing on hardware remain unverified. For local signing use
`python3 tizen/build.py --generic --sign PROFILE` with a Samsung certificate profile,
then install that signed WGT.

## CCTV limitations

Live view only. Android uses native RTSP; NVR authentication, codecs, VPN routing and
simultaneous stream limits need hardware tests. Samsung uses private **HLS**, not raw
Hikvision RTSP, and needs a local RTSP-to-HLS gateway. No gateway is included or deployed.
The Hikvision desktop browser plugin cannot run on Tizen. A 16-cell layout does not prove
that a TV can decode 16 streams. Start with one H.264 substream.

Never publish CCTV ports or put credentials in GitHub/chat. Enter viewer credentials on
Android TV; they are encrypted in app storage. Keep remote access behind your VPN.
See [installation details](https://github.com/pnntrn/freemytv/blob/main/docs/INSTALL_CUSTOM.md).
