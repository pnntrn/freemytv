# Verification record — 21 October 2026

Repository: https://github.com/pnntrn/freemytv
Original MIT LICENSE remains byte-for-byte unchanged.
Sarabun regular/semibold and their SIL OFL license are bundled locally.

## Actual GitHub evidence

- Phase 1 corrected CI: https://github.com/pnntrn/freemytv/actions/runs/39598584491 — passed.
- Android feature PR: https://github.com/pnntrn/freemytv/pull/1 — merged after CI passed.
- Android feature CI: https://github.com/pnntrn/freemytv/actions/runs/39599800703 — passed.
- Tizen/layout PR: https://github.com/pnntrn/freemytv/pull/2
- Tizen/layout CI: https://github.com/pnntrn/freemytv/actions/runs/39602292125 — passed before the final
  component-test/CSS follow-up. Check the PR's latest checks for the follow-up result.

GitHub CI compiles Java into an APK, verifies its signature, builds the unsigned Tizen WGT and
TizenBrew module archive, and exercises Python packaging/translation and Java private-address,
channel/order/grid boundary tests. JavaScript tests cover private HLS input policy, Thai language,
12/16/custom layouts, component navigation, stream cleanup and persistence boundaries.

Local shell/JavaScript syntax and packaging checks pass. The local environment has no Android
SDK or javac compiler; Java/Android checks run on GitHub's JDK/SDK runner.

## Implementation boundaries

- Default row: YouTube, Netflix, Viu, Disney+, Prime Video, iQIYI, CCTV.
- Android: missing apps link to official store pages; they are not silently installed.
- Samsung: discovers official installed apps; missing apps must be installed through Samsung Apps.
- Android CCTV: native MediaPlayer RTSP, 2 encrypted private profiles, channels up to 64.
- Web/Tizen CCTV: private HLS gateway required; stream URLs are session-only.
- Layouts: 1/4/9/12/16 plus custom 1–4 rows/columns; reorder/subset/blank slots.
- Camera support: compatible standard RTSP or HLS; proprietary/cloud camera support is not included.
- Shortcuts: app-focused only; no guarantee that firmware-reserved buttons are delivered.

## Remaining actual-device/configuration work

No TV, NVR or VPN was connected. These are not verified: stream authentication/codec compatibility,
LAN/VPN routing, Android Keystore behavior on TV, decoder limits (especially 12/16), real remote
focus behavior/Thai rendering, official-app store availability, Samsung signing/install or TizenBrew loading.

No persistent Android release-signing secrets or Samsung certificates were supplied. Ordinary APK
artifacts use temporary CI keys; Tizen WGT artifacts are unsigned. The release workflow produces
draft artifacts only after the configured persistent Android signing secrets are supplied.

Daily upstream PR review is configured; no update has yet been observed through an actual
scheduled run. GitHub's Actions setting permitting workflow-created PRs cannot be read/changed by
the available connector. A browser connection was attempted but was unavailable. The owner should
check Settings > Actions > General > Allow GitHub Actions to create and approve pull requests.
The workflow itself never approves or merges any pull request.

See INSTALL_CUSTOM.md for installation steps, private-network setup and the hardware checklist.
