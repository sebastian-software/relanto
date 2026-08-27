# Repository licensing, security, and contributions

**Plan status:** Implemented
**Source:** effective-flow plan
**Recommended workflow:** Documentation (`effective-flow docs`)
**Target path:** SECURITY.md

## Requirement

Complete Relanto's repository-level licensing, vulnerability-reporting, and contribution guidance without changing product behavior. The current remote `main` baseline (`0ad703ad82bf53210b23e4da4d6a359e3cfb1168`, inspected on 2026-08-26) already contains the canonical MIT license, MIT metadata in all package manifests, and the README license badge and section. The implementation must preserve that baseline and add only the missing security and contribution guidance plus discoverable README links.

The local planning checkout is based on `2386142` and is behind remote `main`. It also contains unrelated staged plan-file renames and an untracked `.pnpm-store/`. Implementation must start from a current `main`-based worktree and must not reset, absorb, or document the stale local checkout as the current repository state.

This is a Documentation change because it adds repository policies and contributor guidance without changing application behavior, code, configuration, or dependencies. Root-level community-health files are an established GitHub repository convention, so this plan intentionally uses that repository-native structure instead of a `docs/<category>/` target and omits the doc-category field.

## Architecture decisions

- Treat MIT licensing as an existing, verified contract. Do not replace or rewrite `LICENSE`, the package-manifest `license` fields, or the README license statement unless the execution preflight proves that the current baseline has drifted; any such drift stops the workflow for a new licensing decision.
- Add `SECURITY.md` at the repository root in German. It names `security@sebastian-software.de` as the confidential reporting channel, warns against public vulnerability issues, requests the minimum useful report details, supports only the current released version, and makes no fixed response-time promise.
- Use coordinated disclosure without a fixed deadline: reporters are asked to keep vulnerability details confidential until a fix is published or both sides agree on another disclosure point.
- Keep GitHub Private Vulnerability Reporting out of this change while the repository is private. When the repository is published, enable the GitHub setting separately and update `SECURITY.md` so the GitHub form becomes the preferred channel while the role mailbox remains the fallback.
- Add `CONTRIBUTING.md` at the repository root in German. It documents the current, credential-free setup and repository conventions derived from the current `main` branch. Contributions are accepted under the project's MIT license without a Contributor License Agreement or Developer Certificate of Origin requirement.
- Use a hybrid contribution intake rule: focused documentation changes and small bug fixes may be submitted directly as pull requests, while new features, breaking changes, and architecture changes require prior agreement in an issue.
- Update the root `README.md` only to add concise, user-visible links to the security and contribution policies. Preserve its product-focused structure and existing MIT license section.
- Do not add a code of conduct, issue or pull-request templates, CODEOWNERS, governance files, or support policy in this change. Reconsider those files when the repository is published or concrete community workflows require them.

## Affected files

| File              | Description                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SECURITY.md`     | New German security policy covering supported versions, confidential reporting, report contents, handling expectations, and coordinated disclosure.      |
| `CONTRIBUTING.md` | New German contributor guide covering prerequisites, setup, workflow, repository conventions, validation, and MIT contribution terms without CLA or DCO. |
| `README.md`       | Add concise links to `SECURITY.md` and `CONTRIBUTING.md` in the existing further-documentation area while preserving the existing license section.       |

## Implementation details

### Approach

1. Start from a current `main`-based worktree and verify that it includes the merged licensing and dependency-cleanup baselines from pull requests #215 and #216. Confirm that root, backend, and frontend package manifests declare `MIT`, that `LICENSE` is the canonical MIT text for Sebastian Software GmbH, and that standard contributor setup no longer needs a private registry token. Stop rather than recreate or reinterpret licensing if those facts are no longer true.
2. Verify that `security@sebastian-software.de` is an operational role mailbox with appropriate maintainer access before publishing it. If the mailbox is unavailable or unmonitored, stop and obtain a replacement channel instead of committing a nonfunctional security policy.
3. Create `SECURITY.md` with sections for supported versions, confidential reporting, requested evidence, handling and coordinated disclosure. State that only the current released version receives security fixes, that reporters must not create public issues, and that the project acknowledges and assesses reports without promising a fixed response SLA. Ask reporters to keep details confidential until a fix is published or both sides agree on another disclosure point. Do not claim that GitHub Private Vulnerability Reporting is active.
4. Create `CONTRIBUTING.md` with the supported prerequisites (`Node.js 24.18.0` from `.nvmrc` and `pnpm 11.10.0` from `package.json`), credential-free installation and local development entry points, links to the existing architecture and testing guides, the `pnpm agent:check` delivery gate, German prose and English identifiers/commit messages, the React Router route-registration rule, and the release-please commit types that trigger releases. State explicitly that contributions are submitted under MIT without CLA or DCO. Allow focused documentation changes and small bug fixes as direct pull requests, and direct contributors to obtain agreement in an issue before starting features, breaking changes, or architecture changes.
5. Add links for contributing and confidential vulnerability reporting to the existing `README.md` further-documentation section. Retain the existing MIT badge, license section, and product-facing content unchanged.
6. Review every command, path, version, and policy claim against the implementation branch. Keep volatile details linked to their owning files where possible instead of duplicating more repository internals than contributors need.

### Edge cases

- If `SECURITY.md` or `CONTRIBUTING.md` appears on the implementation base before work starts, reconcile the existing file instead of overwriting it and revise this plan if its policy conflicts with the decisions above.
- If the repository becomes public before this plan is implemented, keep enabling Private Vulnerability Reporting as a separately authorized GitHub setting change; do not silently widen a documentation workflow into remote repository administration.
- If current `main` no longer uses MIT consistently, stop because changing or repairing the license requires an explicit legal decision rather than a documentation assumption.
- If the documented Node.js, pnpm, setup, validation, language, routing, or release conventions have changed, use the current repository-owned values and record the plan drift before continuing.
- Do not include secrets, internal vulnerability details, personal contact data, or a personal maintainer address in either policy.

## Acceptance criteria

- [ ] On a current `main`-based implementation branch, `LICENSE`, the root/backend/frontend package manifests, and the README consistently retain the existing MIT license without substantive license-text changes.
- [ ] `SECURITY.md` exists at the repository root in German and names `security@sebastian-software.de`, supports only the current release, forbids public vulnerability issues, lists the information requested from reporters, describes coordinated handling without a fixed SLA, asks for confidentiality until a fix or another mutually agreed disclosure point, and does not claim that Private Vulnerability Reporting is already enabled.
- [ ] `CONTRIBUTING.md` exists at the repository root in German and accurately documents the current credential-free setup, supported tool versions, repository conventions, required `pnpm agent:check` validation, MIT inbound contribution terms without CLA or DCO, and the agreed hybrid intake rule for direct pull requests versus prior issue alignment.
- [ ] `README.md` links to `SECURITY.md` and `CONTRIBUTING.md`, and every added relative link resolves from the repository root.
- [ ] No code, runtime configuration, dependency, code-of-conduct, template, CODEOWNERS, governance, or remote GitHub-setting change is included.
- [ ] `git diff --check`, the repository formatter check, and `pnpm agent:check` pass from the implementation worktree, producing one reviewable documentation-only diff that satisfies all criteria above.

Together these checks define one completion condition: the current MIT baseline remains intact while the two missing, discoverable repository policies are accurate, operational, and validated without adjacent governance or product changes.

## Validation plan

- Compare `LICENSE`, `package.json`, `packages/backend/package.json`, `packages/frontend/package.json`, and the README license section against the current implementation base to demonstrate that licensing was preserved rather than recreated.
- Confirm the role mailbox operationally outside the repository without recording credentials, recipients, or private test-message content in the plan or committed files.
- Run `git diff --check` and `pnpm format:check` to catch whitespace and Markdown-formatting defects.
- Run `pnpm agent:check`, as required by `AGENTS.md`, and report any pre-existing or environment-dependent failure separately from documentation regressions.
- Inspect the final diff to verify that only `SECURITY.md`, `CONTRIBUTING.md`, and the intended `README.md` links changed, and manually resolve every added relative link.
- After a future public release, verify GitHub's community profile and Private Vulnerability Reporting setting in a separate, explicitly authorized follow-up.

## Assumptions and open points

- The agreed security mailbox is `security@sebastian-software.de`; implementation must verify that it is operational before publication.
- Only the current released version receives security fixes; no backport matrix or response-time SLA is promised.
- GitHub Private Vulnerability Reporting will be enabled when the repository is published, outside this documentation-only implementation.
- Contributions use the existing MIT license without CLA or DCO.
- The intentionally deferred community files and GitHub settings are not blockers for this focused change.

## Plan review

**Result:** Approved

### Summary

| Area            | Critical | Important | Note |
| --------------- | -------: | --------: | ---: |
| Architecture    |        0 |         0 |    0 |
| Security        |        0 |         1 |    0 |
| Data protection |        0 |         0 |    0 |
| Error cases     |        0 |         0 |    0 |
| Testability     |        0 |         0 |    0 |
| Scope           |        0 |         1 |    0 |
| Maintainability |        0 |         0 |    0 |

### Findings

- **Important — Scope (resolved):** The contribution intake workflow did not say whether contributors may open pull requests directly or must first obtain agreement in an issue. The selected hybrid rule now permits direct pull requests for focused documentation changes and small bug fixes and requires prior issue agreement for features, breaking changes, and architecture changes.
- **Important — Security (resolved):** The plan called for coordinated disclosure but did not define when a reporter may publish vulnerability details. The selected rule now asks reporters to keep details confidential until a fix is published or both sides agree on another disclosure point, without introducing a fixed deadline.

## Test results

- `pnpm agent:check`: passed — lint completed with 0 errors and 17 warnings; format checking, type checking, and the frontend build passed; 47 test files and 415 tests passed.
- `git diff --check`: passed.
- Relative Markdown links and anchors in `README.md`, `SECURITY.md`, and `CONTRIBUTING.md`: passed.
- The canonical `LICENSE` and the root, backend, and frontend package-manifest license fields remained unchanged and continue to declare MIT.
- The final change scope before archival contained only `README.md`, `SECURITY.md`, and `CONTRIBUTING.md`.
- The user confirmed on 2026-08-26 that `security@sebastian-software.de` is operational and monitored.

## Review findings

- The technical documentation writer and README writer completed their non-overlapping assignments without scope violations.
- Independent validation found no remaining critical or important documentation findings.
- No security finding, product-code change, dependency change, runtime configuration change, or adjacent governance file was introduced.

## Open points

- No open points.
