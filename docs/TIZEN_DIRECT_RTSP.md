# Direct Hikvision RTSP inside FreeMyTV (experimental)

This mode opens from FreeMyTV's **CCTV** tile. The TizenBrew runtime runs a small Node
service **on the TV**, receives the NVR's RTSP/TCP H.264 or HEVC stream, and remuxes it to
fragmented MP4 for the TV's MSE decoder. No PC, NAS, FFmpeg process, WASM module, or
external npm dependency is used during playback. A PC is needed for development/install.

The plain signed/unsigned FreeMyTV WGT does not include a Node runtime. Direct mode
therefore requires the **FreeMyTV TizenBrew module and its serviceFile**, not merely
installing FreeMyTV's WGT with TizenBrew Installer. HLS mode remains available in the WGT.

## Current evidence and limits

- The UA49MU6100/Tizen 3 hardware diagnostic reports MSE, H.264, WebSocket and WebGL;
  WebAssembly is absent. This is a capability test, not a successful camera playback test.
- A test-only RTSP server verifies Digest authentication and interleaved RTP over TCP.
  Real FFmpeg-generated H.264 and HEVC are depacketized (including STAP-A, FU-A and timestamp wrap),
  remuxed, inspected by ffprobe, and fully decoded by FFmpeg in tests.
- TizenBrew 2.0.5 installed on the real TV, the FreeMyTV module service started without
  a runtime crash, and its loopback client handshake returned HTTP 200. FreeMyTV's CCTV
  connection form loaded in the TV's browser engine. The real NVR's unauthenticated
  RTSP response advertises Digest/MD5; no account credentials were used for this check.
- Actual NVR authentication, TV MSE playback,
  decoder concurrency and extended operation must still be verified on the TV.
- Progressive H.264 and single-layer HEVC without reordered pictures. H.265+ is undergoing actual-device verification; it is not yet claimed compatible. B frames, interlaced video,
  MPEG-PS RTP payloads, audio, and proprietary Hik-Connect transport are not supported.
  Unsupported formats fail explicitly; there is no hidden conversion or PC fallback.

## On-TV setup and acceptance

1. Install TizenBrew and load the FreeMyTV module containing `service/nvr-service.js`.
   Run `python tizen/module.py` to create the distributable archive; it is not itself
   a published npm/GitHub module. Module hosting and registration are separate steps.
2. Open **FreeMyTV → CCTV → Configure NVR → Direct RTSP on TV (TizenBrew)**.
3. Enter the private IPv4 address, RTSP port (usually 554), a viewer account and channel
   count on the TV. Passwords never belong in GitHub, chat, build config or URL templates.
   Direct mode starts with one tile. Use an H.264 baseline/progressive substream for the
   first test; avoid changing the main recording stream.
4. Verify channel 1 for 15 minutes, then try channel 16 and expand/restore with OK/Back.
   The **Substream/Main stream** button requests the corresponding existing NVR stream;
   it does not change the NVR encoder configuration or recording settings.
5. If the NVR exposes an H.264 channel-zero stream at `/Streaming/Channels/001`, try
   **NVR mosaic (Channel Zero)**. Set up a 4×4 mosaic on the NVR itself if supported by
   that firmware. This button requests one composed stream; it does not configure the
   NVR or guarantee channel-zero support. Individual cells cannot expand separately.
6. Otherwise increase the separate-stream grid from 1 to 4 and only then towards 16.
   The software has a 16-stream bound, not a claim that this TV has 16 decoders.
7. Confirm an hour of actual playback, Wi-Fi disconnect/reconnect, background/foreground,
   and closing/reopening CCTV. After startup, turn off the PC to prove there is no relay.

Credentials are session-only: reopening CCTV requires entry again. Leaving/backgrounding
the viewer releases players. Network failures retry up to three consecutive times, with
backoff. Authentication/format failures do not retry, avoiding repeated bad-password logins.

## Service boundaries

The service binds only `127.0.0.1:8766` on the TV. It accepts the TizenBrew module origin
`http://127.0.0.1:8081`, a non-simple request header, and random client/stream capabilities.
Only unambiguous RFC1918 IPv4 NVR addresses are accepted. RTSP tracks cannot redirect to
another host/port. Fragment and packet queues are bounded; idle sessions expire. Credentials
are neither logged nor written to disk and are cleared when the session is released.

Other modules in the same TizenBrew origin share its trust boundary. Use trusted modules
and a trusted LAN. RTSP/TCP is not encrypted. This feature does not alter NVR settings,
router settings, port forwarding, or the TV's default launcher.

## Verification commands

```
node tests/cctv.test.js
node tests/cctv-ui.test.js
node tests/nvr-player.test.js
node tests/nvr-direct.test.js
python -m unittest discover -s tests -v
python tizen/module.py
```

The direct media integration test requires FFmpeg/ffprobe and a private IPv4 interface
for its local fake NVR. Those are test tools, not playback dependencies.
