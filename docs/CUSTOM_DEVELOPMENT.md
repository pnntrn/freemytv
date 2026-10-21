# Custom Free My TV development status

Phase 1 is prepared locally, pending creation of the GitHub fork and publication.
No custom Android or CCTV feature is implemented yet. No television or NVR has been tested.

## GitHub setup

Fork `simbasjungles/free-my-tv` into the connected `pnntrn` account, keeping `main`.
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

## Remaining stages

1. Android: Thai translations, bundled Sarabun with its font license, Surin weather defaults,
   configurable settings shortcut, and navigation tests.
2. CCTV: two private NVR profiles, secure credential storage, LAN/VPN-only endpoint validation,
   camera paging and remote-friendly grids. Choose playback integration after reviewing the
   dependency-free Android build and NVR stream formats. No credentials in stream logs or exports.
3. Tizen: extend the upstream `web/` and `tizen/` implementation, share translations/assets,
   verify TizenBrew packaging and Samsung media capabilities. Do not promise Android APK support.
4. Verify builds and write final Android/Tizen installation and hardware test instructions.

Do not expose NVR RTSP, HTTP, management or ONVIF ports to the Internet.
Use OpenWrt VPN routing for VIGI remote access. Do not configure router changes without actual
network details. Use a least-privilege viewer account for cameras rather than the NVR admin account.
Tizen simultaneous decode limits, codec support, RTSP authentication and VPN reachability require
real TV/NVR tests. A private LAN/VPN stream gateway may be necessary; that decision is not verified.
