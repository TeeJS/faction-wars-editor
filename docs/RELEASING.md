# Releasing

A release has three builds from two places:

| Platform | Built by | Signing | Proof it worked |
|---|---|---|---|
| macOS arm64 + x64 (`.dmg`, `.zip`) | GitHub Actions (`release.yml`) | Developer ID; the apps **and** the disk images are notarized and stapled | the build guard fails otherwise; the log shows `codesign --test-requirement="=notarized"`, `spctl` and `stapler validate` |
| Linux x64 (AppImage, `.deb`, `.tar.gz`) | GitHub Actions (`release.yml`) | none | — |
| Windows x64 (installer, portable) | this PC (`scripts\release-win.ps1`) | Azure Trusted Signing | `Get-AuthenticodeSignature` = Valid for every exe |

## One-time setup: the macOS secrets

The certificate is the **Developer ID Application** identity in your Mac's login keychain (the one git-updater signs with).

1. **Export it on the Mac.**
   1. In Keychain Access, open the **login** keychain and choose **My Certificates**.
   2. Right-click **Developer ID Application: …** and choose **Export…**.
   3. Pick **Personal Information Exchange (.p12)** and set an export password.
   4. Keep the private key: export from **My Certificates**, so the key comes with it.
2. **Create an app-specific password.** At [account.apple.com](https://account.apple.com), go to **Sign-In and Security → App-Specific Passwords**.
3. **Find your Team ID.** At [developer.apple.com/account](https://developer.apple.com/account), look under **Membership details**.
4. **Add five repository secrets:**
   - `MAC_CERT_P12_BASE64`: the `.p12` file, base64-encoded.
   - `MAC_CERT_PASSWORD`: the export password from step 1.
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
   - `APPLE_TEAM_ID`

   `gh secret set NAME -R TeeJS/faction-wars-editor` prompts for the value, so it never lands in your shell history. You can also use **Settings → Secrets and variables → Actions** on GitHub.
5. **Delete the exported `.p12` file** once the secret is set.

## Every release

1. **Dry run first.** On GitHub, go to **Actions → Release → Run workflow** and leave "dry run" ticked.
   - It signs, notarizes and packages without creating a release.
   - The builds are attached to the run as artifacts.
2. **Bump and tag.** Set `package.json` `version` to the new number, commit, and push the tag `vX.Y.Z`. The workflow builds again and creates a **draft** release with the macOS and Linux files.
3. **Windows**, on this PC:
   1. Run `Connect-AzAccount` if the session has expired.
   2. Run:

      ```powershell
      .\scripts\release-win.ps1 -Tag vX.Y.Z
      ```

   The script builds the installer and the portable exe, fails unless every exe is validly signed, and uploads them to the draft.
4. **Publish.** Review the draft (all files present, notes right), then publish it.
