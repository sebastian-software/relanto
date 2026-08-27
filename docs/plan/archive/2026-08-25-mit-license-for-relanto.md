# License Relanto under MIT

**Plan status:** Implemented
**Source:** effective-flow plan
**Recommended workflow:** Documentation (`effective-flow docs`)
**Target path:** LICENSE

## Requirement

Relicense the tracked Relanto repository from its current proprietary/`UNLICENSED` state to the MIT License. The authorized representative of Sebastian Software GmbH confirms that the company holds the necessary rights and selected the exact copyright line `Copyright (c) 2026 Sebastian Software GmbH`.

This is a Documentation change because it establishes repository licensing, synchronizes package metadata, and removes directly contradictory licensing prose without changing application behavior. The implementation is limited to publication-readiness point 1. It must not replace `@redacted/assets`, change repository or GHCR visibility, alter CI, or take on any other publication-readiness work.

Verified repository context as of commit `2386142` on 2026-08-25:

- No tracked `LICENSE`, `LICENCE`, `COPYING`, or `NOTICE` file exists.
- The root, frontend, and backend package manifests declare `UNLICENSED` while remaining private packages.
- `README.md` contains a proprietary-license badge, restrictive licensing prose, and an “All rights reserved” footer.
- `docs/ghcr-image-visibility.md` requires the container image to remain private and currently justifies that requirement by calling Relanto proprietary and prohibiting third-party use.
- The application footer contains a plain copyright attribution without restrictive language and is compatible with MIT licensing.
- The relevant licensing target files had no uncommitted changes when this plan was prepared. The Effective Flow setup migration introduced separate staged legacy-plan renames under `docs/plan/`; those workflow-artifact changes are not part of this implementation scope.

## Architecture decisions

- Add the canonical MIT License text at repository root in `LICENSE`, using the user-specified copyright line verbatim. Do not paraphrase, abbreviate, or add project-specific restrictions to the license text.
- Use the SPDX identifier `MIT` in all three workspace package manifests. Preserve every existing `private: true` declaration because npm publication policy is independent of source licensing.
- Update the German root README only where it represents the license: switch the badge to MIT, replace proprietary restrictions with a concise MIT statement linking to `LICENSE`, and retain the company attribution without “All rights reserved.”
- Correct the contradictory licensing rationale in the GHCR visibility runbook while preserving its operational requirement and recorded status that the image remains private. Source licensing and package visibility are separate decisions.
- Leave the application footer and its tests unchanged. `Copyright 2026 Sebastian Software GmbH` is attribution, not a restriction on MIT-granted rights.
- Do not regenerate `pnpm-lock.yaml`; the workspace license fields are not mirrored there and no dependency graph changes.
- Do not rewrite historical plans, changelogs, or release records. Historical statements remain historical evidence rather than current licensing declarations.
- Do not describe third-party dependencies or the private `@redacted/assets` package as MIT-licensed by this repository change. Their replacement, redistribution rights, and credential-free installation remain separate publication-readiness work.

## Affected files

| File                             | Description                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LICENSE`                        | Add the canonical MIT License with `Copyright (c) 2026 Sebastian Software GmbH`.                                                                                  |
| `package.json`                   | Change the SPDX license value from `UNLICENSED` to `MIT`; preserve `private: true` and all unrelated metadata.                                                    |
| `packages/frontend/package.json` | Change the SPDX license value from `UNLICENSED` to `MIT`; preserve `private: true` and all unrelated metadata.                                                    |
| `packages/backend/package.json`  | Change the SPDX license value from `UNLICENSED` to `MIT`; preserve `private: true` and all unrelated metadata.                                                    |
| `README.md`                      | Replace the proprietary badge, restrictive license section, and restrictive footer wording with consistent MIT licensing and company attribution.                 |
| `docs/ghcr-image-visibility.md`  | Remove only the proprietary/external-use rationale while retaining the private-image requirement, verification procedure, remediation procedure, and status note. |

## Implementation details

### Approach

1. Revalidate the repository root, branch, current HEAD, and the absence of in-scope working-tree changes. If any affected file changed after this plan was written, re-read its licensing statements and update the plan before proceeding rather than overwriting concurrent work.
2. Create `LICENSE` from the canonical MIT License text and insert the exact copyright line supplied by the rights holder.
3. Set `license` to `MIT` in the root, frontend, and backend `package.json` files without changing their `private` fields or causing a lockfile update.
4. In `README.md`, change the license badge to MIT and link it to the existing `#lizenz` section. Replace the proprietary license paragraphs with a short German statement that the repository source is available under MIT and points to `LICENSE`. Remove “All rights reserved” from the branding footer while retaining the Sebastian Software GmbH copyright attribution.
5. In `docs/ghcr-image-visibility.md`, keep the explicit private-visibility instruction and existing operational steps. Replace only the claim that proprietary licensing and prohibited third-party use require that visibility, making clear that the runbook records a separate operational decision.
6. Review the complete diff for license consistency, unchanged exclusions, canonical license wording, and the absence of unrelated edits; then run the focused metadata checks and the repository-native validation gate.

### Edge cases

- The MIT text must contain no additional usage, redistribution, commercial-use, or hosting restriction; such a restriction would contradict the selected license.
- `private: true` must not be removed or interpreted as a licensing conflict. It continues to prevent accidental package publication.
- The GHCR image must not be made public in this change. Only the obsolete licensing rationale changes.
- The current application footer and its tests must remain unchanged because they contain compatible attribution without “All rights reserved.”
- The README must not claim that separately distributed dependencies or assets are relicensed by the repository-level MIT License.
- `pnpm-lock.yaml`, CI workflows, repository settings, package settings, and asset dependencies must remain unchanged.

## Acceptance criteria

- [x] Root `LICENSE` contains the canonical MIT License text and exactly the copyright line `Copyright (c) 2026 Sebastian Software GmbH`, with no additional restrictions.
- [x] `package.json`, `packages/frontend/package.json`, and `packages/backend/package.json` each declare `"license": "MIT"` and still declare `"private": true`.
- [x] `README.md` displays an MIT license badge, links readers to `LICENSE`, contains no current proprietary-use prohibition, and preserves Sebastian Software GmbH attribution without “All rights reserved.”
- [x] `docs/ghcr-image-visibility.md` no longer calls Relanto proprietary or prohibits third-party use, while its requirement, verification path, remediation path, and status note continue to keep the GHCR image private.
- [x] No tracked application footer or footer test changes are present, and no change is present in `pnpm-lock.yaml`, CI, dependency declarations, repository/GHCR visibility, or any other publication-readiness area.
- [x] A scoped search finds no `UNLICENSED`, proprietary-license badge, current “proprietäre Software”, current “keinerlei Nutzungsrechte”, or “All rights reserved” declaration in the six affected licensing surfaces.
- [x] Relative to the recorded pre-implementation working-tree baseline, the implementation delta contains only the six affected files, `git diff --check` passes, and `pnpm agent:check` exits successfully.

Together, these checks define one completion condition: the tracked repository consistently grants the MIT License with the confirmed company copyright while all explicitly excluded publication work and runtime behavior remain unchanged.

## Validation plan

- Confirm the exact copyright with `rg -n -F 'Copyright (c) 2026 Sebastian Software GmbH' LICENSE`; expect exactly one match.
- Parse all three package manifests with the repository's required Node runtime and assert that `license` equals `MIT` and `private` equals `true` in each file.
- Search `LICENSE`, `README.md`, the three manifests, and `docs/ghcr-image-visibility.md` for `UNLICENSED`, the proprietary badge/text, denied third-party rights, and “All rights reserved”; expect no contradictory current declaration.
- Inspect `docs/ghcr-image-visibility.md` to confirm that the image is still required to remain private and that its verification, remediation, and status sections are unchanged apart from the licensing rationale.
- Run `git diff --exit-code -- pnpm-lock.yaml .github packages/frontend/app/root.tsx packages/frontend/app/root.test.tsx packages/frontend/app/lib/server/build-metadata.server.ts`; expect no diff in excluded files.
- Run `git diff --check`; expect exit code 0.
- Run `pnpm agent:check`; expect exit code 0 with lint, format check, typecheck, build, and tests passing.
- Capture the pre-implementation working-tree state, then compare the post-implementation state against that baseline and the affected-files table. Confirm that the licensing implementation added no path outside the six named files; do not attribute the separately staged Effective Flow plan migration or this plan artifact to the licensing implementation.

## Assumptions and open points

- No unresolved implementation assumptions. The rights position, license choice, copyright holder, year, exact copyright line, and scope exclusions are explicit user-confirmed inputs.
- The plan relies on verified repository state at commit `2386142`; the implementation must use the drift check in step 1 if that state changes.

## Plan review

**Result:** Approved

### Summary

| Area            | Critical | Important | Note |
| --------------- | -------: | --------: | ---: |
| Architecture    |        0 |         0 |    0 |
| Security        |        0 |         0 |    0 |
| Data protection |        0 |         0 |    0 |
| Error cases     |        0 |         0 |    0 |
| Testability     |        0 |         0 |    0 |
| Scope           |        0 |         0 |    0 |
| Maintainability |        0 |         0 |    0 |

### Findings

- No findings. The plan separates repository licensing from package publication and GHCR visibility, names every affected current licensing surface, preserves compatible attribution, and provides focused plus repository-native validation.

## Open points

- No open points.

## Test results

- No new automated or browser-E2E test was added because the change introduces no executable behavior or user flow.
- Focused checks passed for the exact LICENSE copyright count, all three manifest license/private assertions, contradictory licensing prose, the retained private-GHCR requirement, excluded paths, and `git diff --check`.
- The final `pnpm agent:check` passed lint, formatting, typecheck, build, 162 backend tests across 13 files, and 221 frontend tests across 33 files. It reported 18 pre-existing, non-blocking lint warnings outside this licensing diff.

## Review findings

- No Critical, Important, or Note findings. The independent review confirmed the canonical MIT text, exact company attribution, consistent package metadata, unchanged publication exclusions, and the separation between source licensing and private container-image visibility.
