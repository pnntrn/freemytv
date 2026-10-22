# Free My TV Surin: install and test

Source: https://github.com/pnntrn/freemytv
Upstream: https://github.com/simbasjungles/free-my-tv

This fork contains code/build verification, not hardware certification. Standalone installation, Thai menus, Surin weather and native app launches were checked on a Samsung UA49MU6100 (Tizen 3). CCTV playback is not verified. Every-camera and every-codec compatibility is not promised.

## Android TV installation

Requires Android 9+ and access to the TV's trusted LAN. Tizen cannot install this APK.

1. Open https://github.com/pnntrn/freemytv/releases/latest and download the Android APK.
   `FreeMyTV-test.apk` is a temporary-key test build; BUILD_INFO.txt records its signing mode.
2. Ordinary CI uses a temporary signing key: use it for testing only. Another CI build may
   not update that installation. Uninstalling to change keys clears NVR settings/credentials.
   For ongoing use, configure the persistent signing secrets in CUSTOM_DEVELOPMENT.md and
   build a versioned release. No permanent signing secrets have been supplied.
3. Enable developer options and USB/network debugging on the TV. On your computer:
   adb connect TV_IP:5555, then adb install -r FreeMyTV.apk.
   Accept the debugging prompt on the TV. Some devices require pairing or USB instead.
4. Open Free My TV from Apps and test before switching the default launcher.
   The original on-TV Home Screen switch changes launcher/screensaver and disables its listed
   promotional apps. Read the upstream README, use the on-TV switch, then confirm Original
   restores the TV normally. Do not force the launcher switch from a remote shell.
5. New installs default to Thai, Sarabun, Celsius and Mueang Surin. Existing on-TV preferences win.
6. Default tiles: YouTube, Netflix, Viu, Disney+, Prime Video, iQIYI and CCTV.
   Missing Android apps show Install and open their official Play Store page. Complete
   installation and sign-in on the TV. Regional/device availability remains unverified.
7. Open Settings and CCTV in the home drawer. Menu opens these controls while the home/CCTV
   app is focused. Change it to Disabled, Menu, Info or a color key. This does not operate
   inside other apps; the TV firmware can reserve keys.

## Android CCTV and custom layouts

Choose Hikvision LAN or VIGI via VPN, then Configure NVR. Enter the private IPv4 address,
RTSP port, least-privilege viewer account, channel count and relative stream path on the TV.
Do not enter passwords in GitHub or chat. Whole profiles are encrypted with Android Keystore
AES-GCM in no-backup app storage. Reinstallation/key loss may require reconfiguration.

Hikvision substream starting point: /Streaming/Channels/{channel}02
VIGI substream starting point: /ch{channel}/sub/av_stream
These are editable, firmware-dependent templates; verify against the NVR manual and VLC.
For another compatible single IP camera, set Channels=1 and its exact relative path, such as
/stream1. Multi-channel query templates such as /cam/realmonitor?channel={channel}&subtype=1 are also accepted. This is a generic RTSP adapter, not every vendor's proprietary/cloud camera protocol.
There is no ONVIF discovery or Hik-Connect/VIGI Cloud SDK integration.

Grid includes 1, 4, 9, 12 and 16 cells, plus custom 1–4 rows and 1–4 columns.
Arrange accepts row-major channel numbers, e.g. 3,1,0,2. Zero is a blank tile. A subset is allowed;
duplicates are rejected to avoid duplicate decoding. Grid shape and per-NVR ordering are saved.
Previous/Next pages through the arranged channels, up to 64 configured channels.
OK expands a tile; Back restores the grid. Both NVRs are selectable; a grid uses one NVR at a time.

A 16-cell layout does not certify 16 simultaneous decoded streams. Start with one H.264 substream
without H.264+/H.265+ enhancements, then four, then larger layouts. Audio is muted.
A connection times out after 20 seconds. Leaving/backgrounding the viewer releases its players.

## OpenWrt VPN boundaries

Establish routing before opening VIGI. The TV's router must route the remote private subnet
through the VPN; connecting only a phone/computer does not connect the TV.
Use distinct subnets, correct return routes, and firewall rules limited to viewer-to-NVR traffic.
Check RTSP/RTP transport and required ports against actual NVR/player firmware.
No OpenWrt settings were changed.

Do not forward NVR HTTP, RTSP or ONVIF ports publicly. No UPnP forwarding is configured.
Only RFC1918 IPv4 literals are accepted; public addresses, hostnames and ambiguous IP forms fail.
This validation does not establish/prove VPN connectivity. Use trusted stream servers: native
players can follow protocol redirects, so private-address validation alone cannot constrain a
compromised server's behavior.

## Samsung Tizen installation

The 1.1 Thai fork installs as **Free My TV Surin** (`FreeMyTVth.FreeMyTV`), separately from upstream Free My TV. It retains the 1.1 Tizen app discovery and logos, with Thai/Sarabun and Surin/Celsius defaults.


The separate web implementation shares translations, defaults, fonts and design assets.
It does not run Android Java/APKs, replace Smart Hub or auto-install third-party apps.
The manifest targets Tizen 3+ (typically 2017+). Confirm the exact model/year/firmware;
“7 Series” alone cannot establish compatibility.

1. Enable Samsung's Developer Mode (commonly Apps > 1 2 3 4 5), enter the computer's IP as
   Host PC IP, and restart as Samsung directs.
2. Install Tizen Studio, TV tools and certificate support. Create the appropriate certificate
   profile for the TV, including its DUID where required. Keep passwords/certificates local.
3. Build and sign: python3 tizen/build.py --generic --sign PROFILE.
   The CI WGT is unsigned and cannot be installed as-is. Updates need the same signing identity.
4. Connect using sdb connect TV_IP. Inspect sdb devices and use the exact target serial.
   Install: tizen install -n FreeMyTV-tizen.wgt -t TARGET
   Launch: tizen run -p FreeMyTVth.FreeMyTV -t TARGET
5. Install official streaming apps through Samsung Apps where available. Installed apps are
   discovered by ID/name. Missing tiles report Not installed and do not simulate installations.
6. Blue opens Home Settings while this app has focus. Change/disable it in Home Settings.
   Firmware/remote keys reserved by Samsung cannot be intercepted.

For a minimal launcher, choose **YouTube only** in Home Settings. It shows one native YouTube shortcut, caches the discovered app ID, and bypasses the full home startup, recommendations, weather/crypto feeds and refresh timers. OK opens YouTube; Back returns to the TV; Blue restores the full home. This preference changes FreeMyTV only and does not uninstall other TV apps.

For the desktop installer route, use TizenBrew Installer:
https://github.com/reisxd/TizenBrewInstaller
Connect to the TV and use Install from GitHub: `pnntrn/freemytv`. It reads the WGT from the
latest release. Installer source re-signs on Tizen 7+; older TVs receive the package unchanged.
CI packages are unsigned and must be signed before installation. A locally signed custom 1.1 package was accepted on the 2017 UA49MU6100 using a standard Tizen developer certificate, without Samsung account sign-in. Keep the same private author certificate for future updates; never commit or upload its key/password. No signed custom release has been published.
Developer Mode/SDB connectivity is required for either route. Installing upstream will not
give you these custom features. Installing the TizenBrew TV runtime is not required for
this standalone WGT route.

## TizenBrew module investigation

python3 tizen/module.py creates FreeMyTV-tizenbrew.zip with packageType=app, appName, appPath,
keys and self-contained assets, following TizenBrew's application-module schema.
It is a module archive, not an installable WGT or npm publication. Hosting/registration and
device testing remain before one-click module installation can be offered.
https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md

## Tizen CCTV streaming limits

This viewer uses HTML video with private HLS. It does not claim raw NVR RTSP support.
A LAN/VPN gateway must convert/relay RTSP into compatible HLS. No gateway has been deployed.
For the first older-TV test, use H.264 with MPEG-TS HLS and a small substream.

Configure a private URL ending in .m3u8, using {channel} for multi-channel profiles.
Static .m3u8 URLs are allowed for a single channel. Public IPs, embedded user-info passwords,
query tokens and DNS names are rejected. URLs remain in memory and must be reentered after
app close/reload. Only numeric grid shape and channel order are persisted.

The gateway must keep playlists/segments private, avoid public redirects, and restrict access
to approved viewer IPs/VPN peers. A hosted HTTPS TizenBrew module can block HTTP private streams
as mixed content; use compatible trusted HTTPS or test the signed packaged-app route.
Do not disable TLS validation or publish the gateway on the Internet.

The interface supports 1/4/9/12/16/custom layouts, but consumer-TV decoder limits require real
model tests. If only one stream works, use a server-composed mosaic or supported NVR channel-zero
stream converted to HLS. Individual mosaic cells cannot expand unless separate streams exist.

Investigation sources:
- Android network formats: https://developer.android.com/media/platform/supported-formats
- Samsung media: https://developer.samsung.com/smarttv/develop/specifications/media-specifications.html
- Samsung's simultaneous-playback page identifies signage, not blanket consumer-TV support:
  https://developer.samsung.com/smarttv/develop/guides/multimedia/simultaneous-video-playback.html
- VIGI channel-zero concept, subject to model/firmware:
  https://www.tp-link.com/nordic/support/faq/4601/
- Official TV app identities:
  https://play.google.com/store/apps/details?id=com.viu.tv
  https://play.google.com/store/apps/details?id=com.iqiyi.i18n.tv
  https://play.google.com/store/apps/details?id=in.startv.hotstar.dplus.tv

## Hardware acceptance

Record TV/NVR model and firmware and stream codec. Test:
1. Install/launch, Thai shaping and clipping, English switching and Surin weather.
2. Each default app, regional package variants and missing-app installation links.
3. Shortcut presses/holds/disabled setting, Back and Home.
4. NVR configuration, encrypted Android persistence and reconfiguration after reinstall.
5. Local Hikvision, VIGI with VPN, then VPN disconnection and expected stream failure.
6. Channel 1/16/>20, paging boundaries, 12/16/custom/blank/reordered layouts and full screen.
7. NVR switch, foreground/background, offline stream, wrong password, timeout/retry and resources.
8. Tizen signing/install, remote keys, one HLS stream, then progressive multi-stream tests.
9. Router port-forwarding absence, approved VPN ACLs and absence of plaintext secret exports.

Unverified hardware functions include playback/authentication/codecs, VPN routing, secure storage
on a real Android TV, Samsung certificates/install, remote-key delivery and simultaneous decoding.
No TV/NVR passwords or network changes are needed to review/build the source.
