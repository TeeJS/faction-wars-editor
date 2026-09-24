# Releasing

GitHub Actions builds and signs every platform (`.github/workflows/release.yml`). A release is: **push a tag, then publish the draft.** No local computer is needed.

| Platform | Signing | Proof it worked |
|---|---|---|
| macOS arm64 and x64 (`.dmg`, `.zip`) | Developer ID. The apps **and** the disk images are notarized and stapled. | The build guard fails otherwise. The log shows `codesign --test-requirement="=notarized"`, `spctl` (`source=Notarized Developer ID`) and `stapler validate`. |
| Windows x64 (installer, portable exe) | Azure Artifact (Trusted) Signing, logged in through GitHub OIDC. No Azure secret is stored. | A final step fails unless `Get-AuthenticodeSignature` is Valid for every exe. |
| Linux x64 (AppImage, `.deb`, `.tar.gz`) | None | — |

## One-time setup

- **macOS:** five repository secrets: `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
  1. Export the **Developer ID Application** certificate from the Mac's login keychain as a `.p12`, **with a password**.
  2. Create an app-specific password at account.apple.com.
  3. Upload each secret with `gh secret set NAME -R TeeJS/faction-wars-editor`.
  4. Check nothing arrived empty. The workflow's first Mac step names any empty secret.
- **Windows:** an Azure app registration, `github-actions-code-signing`, with:
  - the **Artifact Signing Certificate Profile Signer** role on the `openquake-public` certificate profile;
  - a federated credential for this repo's `release` environment.

  The `release` environment holds `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`. These are IDs, not secrets.

  GitHub's OIDC subject includes numeric IDs: `repo:TeeJS@4136437/faction-wars-editor@1384642508:environment:release`. The federated credential must match it exactly.

## Every release

1. **Dry run (optional).** In GitHub, go to **Actions → Release → Run workflow** and leave "dry run" ticked. It signs all three platforms without creating a release.
2. **Bump and tag.**
   1. Set `package.json` `version`, commit, and push.
   2. Push the tag `vX.Y.Z`. You can also do this on GitHub: **Releases → Draft a new release → create the tag**.
   3. The workflow builds and signs all three platforms and creates a **draft** release. This takes about 10 minutes.
3. **Publish.** Review the draft: all files are present, and the notes are right. Then publish it.

## Fallback: sign Windows on the PC

If Azure CI signing is unavailable, `scripts\release-win.ps1 -Tag vX.Y.Z` builds, signs, verifies and uploads the Windows files from this PC. It needs:
- `Connect-AzAccount`;
- a `.signing\` folder (the dlib and `metadata.json`), copied from another signed repo.
