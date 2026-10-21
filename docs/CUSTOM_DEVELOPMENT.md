# Custom Free My TV development status

Phase 1 is published at https://github.com/pnntrn/freemytv.
The corrected Android and Tizen CI builds passed on 21 October 2026; PR #1 is merged and PR #2 adds Tizen/custom layouts.
Custom Android features are implemented; no television or NVR has been tested.

## Android custom features
Thai text is shared from shared/th.json; Sarabun regular and semibold are bundled with their SIL OFL license.
New installations default to Mueang Surin, Thailand, Celsius and Thai. Existing TV settings take priority.
The shelf defaults to YouTube, Netflix, Viu, Disney+, Prime Video, iQIYI and the internal CCTV interface.
Missing Android apps open their Play Store page instead of silently installing software.
Disney+ and Viu include regional Android TV package aliases. Store/device availability still needs testing.
The home drawer has Settings and CCTV. Its configurable Menu/Info/color shortcut works while this app
has focus; it does not hijack Home, Back, Power or keys owned by another app.
CCTV profiles are encrypted with AES-GCM and an Android Keystore key in no-backup storage.
Only private RFC1918 IPv4 addresses are accepted. Hikvision and VIGI path templates are editable.
The grids support 1/4/9/12/16 tiles with paging up to 64 channels and OK to expand a tile.
Native MediaPlayer RTSP compatibility, authentication and concurrent decoder limits are unverified.

## GitHub setup

The fork is pnntrn/freemytv, with default branch main.
Publish Phase 1 first, then use separate feature branches and pull requests for each stage.
The original MIT license is retained unchanged. The original website deployment is disabled on forks.

The daily workflow runs around 06:17 Asia/Bangkok (23:17 UTC) and can be run manually.
It opens a PR directly from `simbasjungles:main` into the fork's default branch.
It does not reset custom commits, copy credentials, execute fetched code, or merge anything.
An existing open PR is reused. Conflicting updates need manual conflict resolution.

In the fork's Actions page, enable workflows if GitHub initially disables them for the fork.
In Settings > Actions > General, allow GitHub Actions to create pull requests if required.
This setting cannot be configured by the currently available GitHub connector.
GitHub can require approval for CI on bot-created or fork pull requests. Approve the run after
reviewing its workflow changes. Scheduled workflows may be delayed or disabled after inactivity.

## CI and releases

CI runs Python packaging/configuration tests, JavaScript syntax checks, an Android APK build,
signature verification, and an unsigned Tizen WGT build. Pull-request jobs receive no release secrets.
APK artifacts from ordinary CI have a temporary key: they are test builds and cannot reliably
update a previous installation. Do not use those artifacts for permanent deployment.

For permanent Android updates, create and back up your own signing keystore outside GitHub.
Add repository Actions secrets `APK_KEYSTORE_BASE64`, `APK_STORE_PASSWORD`, `APK_KEY_PASSWORD`,
and `APK_KEY_ALIAS`. Never put these values in source code, issues, PRs, or chat.
The release job fails rather than silently creating a temporary key when secrets are missing.
A `custom-v*` tag runs the build and produces a **draft** GitHub release with APK, unsigned WGT,
and SHA256SUMS. Review hardware results before publishing it. Samsung signing is separate.

## Implemented stages and remaining verification

Android features were reviewed in PR #1 and passed GitHub's Android compilation/signature checks
and Java input boundary tests before merging. The subsequent Tizen/layout stage adds 12/16
and custom rows/columns, persistent channel ordering, blank slots, a private HLS viewer and a
TizenBrew module archive builder. INSTALL_CUSTOM.md covers installation and exact limitations.

The original MIT license is unchanged. Sarabun's SIL OFL license is included in both packages.
No real TV, NVR or VPN has been connected. Signing secrets and a Samsung certificate have
not been supplied, so the permanent release/signing flow has not been exercised.

Daily upstream review is configured on main. An actual future upstream-update PR and the repository
setting allowing Actions to create PRs remain unverified; run the workflow manually to check these.
There is no upstream auto-merge.

Do not expose NVR RTSP, HTTP, management or ONVIF ports to the Internet.
Use OpenWrt VPN routing for VIGI remote access. Do not configure router changes without actual
network details. Use a least-privilege viewer account for cameras rather than the NVR admin account.
Tizen simultaneous decode limits, codec support, RTSP authentication and VPN reachability require
real TV/NVR tests. A private LAN/VPN stream gateway may be necessary; that decision is not verified.
