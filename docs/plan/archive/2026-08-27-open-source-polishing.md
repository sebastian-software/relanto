# Open-source polishing

**Plan status:** Implemented
**Source:** effective-flow plan
**Recommended workflow:** Documentation (`effective-flow docs`)
**Target path:** CODE_OF_CONDUCT.md

## Requirement

Raise the repository's GitHub Community Health completeness by adding the contributor-facing files that are still missing: a code of conduct, structured issue templates, and a pull request template. The user reported a Community Health value of 62%; an authenticated API read of the canonical repository on 2026-08-28 likewise returned `health_percentage: 62` and confirmed that all three requested capabilities are absent. Treat the percentage as an observation, not as a guaranteed acceptance target. These files improve contributor guidance and GitHub's repository profile, but they are not conditions of the existing MIT license and must not change its legal text or package metadata.

The corrected implementation starts from canonical `main` at `80312f4`. The isolated in-scope baseline is clean and already contains `README.md`, the canonical `LICENSE`, `CONTRIBUTING.md`, and `SECURITY.md`. The primary checkout contains unrelated staged plan renames and an untracked `.pnpm-store/`; the isolated worktree keeps them outside this delivery.

The canonical GitHub repository is the public repository `sebastian-software/relanto` with `main` as its default branch. A fresh read of all open issues on 2026-08-28 found only [#1, Dependency Dashboard](https://github.com/sebastian-software/relanto/issues/1), which is Renovate tracking and does not cover this work. There is therefore no open issue for the code of conduct, issue templates, pull request template, or a broader community-health polish, and this change creates none.

This is a Documentation change because it adds repository policy and contribution workflow guidance without changing application behavior, dependencies, runtime configuration, or the MIT license. Root-level and `.github/` community-health files are an established GitHub repository structure, so this plan intentionally uses that structure instead of a `docs/<category>/` target and omits the doc-category field.

## Architecture decisions

- Add `CODE_OF_CONDUCT.md` at the repository root from the official German [Contributor Covenant 3.0](https://www.contributor-covenant.org/de/version/3/0/code_of_conduct/). Preserve its Contributor Covenant 3.0 and CC BY-SA 4.0 attribution, replace the reporting-procedure note, include the suggested enforcement and remediation ladder unchanged, and remove the ladder's editorial note from the published file.
- Use `security@sebastian-software.de` as the private code-of-conduct reporting and enforcement contact. The maintainer explicitly confirmed on 2026-08-27 that this existing monitored role mailbox is authorized for that additional purpose.
- Add two GitHub Issue Forms under `.github/ISSUE_TEMPLATE/`: one for reproducible bug reports and one for feature proposals. Use `.yml` forms with GitHub-supported `name`, `description`, and non-empty `body` fields; do not assign labels or assignees that are not already governed by the repository.
- Keep security reports out of public issue forms. Both forms direct reporters to the repository's `SECURITY.md` path without duplicating vulnerability-handling policy or asking for sensitive evidence in public.
- Add `.github/ISSUE_TEMPLATE/config.yml` with `blank_issues_enabled: false` and no `contact_links`. GitHub contact links require literal external URLs, while this repository has no separately verified external security-policy URL. Do not invent a support destination merely to populate the chooser.
- Add one default `.github/pull_request_template.md` in German. It prompts for purpose, related issue when applicable, scope, verification evidence, documentation impact, and breaking or security-relevant effects while remaining short enough that contributors will complete it.
- Add a concise `CODE_OF_CONDUCT.md` reference to `CONTRIBUTING.md` so the conduct expectations and private reporting path are discoverable before a contribution is submitted. Preserve the current hybrid issue/PR intake rules and all existing setup, validation, language, release, and MIT contribution guidance.
- Leave `README.md`, `LICENSE`, `SECURITY.md`, package license metadata, CODEOWNERS, governance files, support policy, GitHub settings, labels, and remote issue state unchanged. Any decision to publish or rename the repository remains separate remote administration.

## Affected files

| File                                         | Description                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CODE_OF_CONDUCT.md`                         | Add the German contributor conduct policy, enforcement responsibilities, private reporting contact, scope, and required attribution.      |
| `.github/ISSUE_TEMPLATE/bug_report.yml`      | Add a structured bug-report form for version, environment, reproduction, expected and actual behavior, and sanitized supporting evidence. |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Add a structured feature-proposal form for the problem, use case, proposed outcome, and considered alternatives.                          |
| `.github/ISSUE_TEMPLATE/config.yml`          | Configure the issue chooser to disable blank issues without inventing external contact destinations.                                      |
| `.github/pull_request_template.md`           | Add the default German pull request checklist and evidence prompts.                                                                       |
| `CONTRIBUTING.md`                            | Link the code of conduct and explain the private reporting route without changing the existing contribution workflow.                     |

## Implementation details

### Approach

1. Start from a current `main`-based implementation worktree. Recheck the six in-scope paths, the repository visibility/default branch, and the current GitHub community-file documentation. If another branch has added any target file or the repository conventions have changed, reconcile rather than overwrite and revise this plan when policy or scope would change.
2. Add `CODE_OF_CONDUCT.md` from the official German Contributor Covenant 3.0 source, preserve its version-matched attribution, replace the reporting-procedure note with confidential reporting to `security@sebastian-software.de`, include the suggested enforcement and remediation ladder unchanged, and remove every remaining editorial note. Stop if the mailbox authorization has been withdrawn or the selected official source has materially changed.
3. Add the bug-report and feature-request Issue Forms. Give every contributor input a unique identifier, require only information necessary to act on the report, include clear privacy/security warnings, and avoid default labels, assignees, log dumps, or mandatory fields that invite credentials or personal data.
4. Add `config.yml` with blank issues disabled and no contact links. Keep security warnings inside both forms and keep questions or general support out of the chooser unless the repository first establishes a stable supported destination.
5. Add the default pull request template with short sections for summary and scope, an optional issue reference consistent with `CONTRIBUTING.md`, verification commands/results, documentation impact, and explicit breaking/security considerations. Do not require a linked issue for the focused documentation changes and small bug fixes that `CONTRIBUTING.md` already permits directly.
6. Add a concise conduct-policy link to `CONTRIBUTING.md`, then inspect all new cross-references and the complete diff. Do not alter the MIT license, existing security policy, README, package metadata, GitHub settings, labels, or issue state.

### Edge cases

- If the official German Contributor Covenant 3.0 source or its attribution requirements differ materially from the source inspected during planning, stop and revise the pinned source decision; do not silently switch versions or combine wording from different versions.
- If no monitored confidential contact is approved for conduct reports, do not publish a code of conduct with a placeholder, personal address, or unmonitored mailbox.
- If an issue form references a label or assignee, remove that metadata unless the target exists and its ongoing ownership is explicitly confirmed; the planned forms require neither.
- If a report may contain a vulnerability, credentials, personal data, or production logs, the templates must route it away from a public issue and toward `SECURITY.md` rather than soliciting the sensitive content.
- GitHub exposes templates to contributors only from the default branch. Validate their syntax in the implementation branch, but treat recognition in the live chooser and Community Health profile as a post-merge verification rather than a pre-merge claim.
- The canonical repository is already public and named `relanto`; do not change repository visibility, naming, GitHub settings, or issue state as part of this documentation change.

## Acceptance criteria

- [ ] `CODE_OF_CONDUCT.md` exists at the repository root, is based consistently on the official German Contributor Covenant 3.0, retains its version-matched attribution, includes its suggested enforcement and remediation ladder unchanged, contains no placeholders or editorial notes, and names `security@sebastian-software.de` as the maintainer-approved monitored private enforcement contact with a clear reporting process.
- [ ] `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/ISSUE_TEMPLATE/feature_request.yml` are valid GitHub Issue Forms with distinct purposes, actionable required fields, unique input identifiers, and clear security/privacy guidance; neither depends on unverified labels or assignees.
- [ ] `.github/ISSUE_TEMPLATE/config.yml` disables blank issues, defines no unverified contact link, and invents neither a general support channel nor a rename-sensitive repository URL.
- [ ] `.github/pull_request_template.md` is the single default German PR template and requests purpose, scope, applicable issue context, verification evidence, documentation impact, and breaking/security effects without contradicting `CONTRIBUTING.md`.
- [ ] `CONTRIBUTING.md` links to the code of conduct and its private reporting route while its setup, validation, intake, language, release, and MIT contribution rules remain substantively unchanged.
- [ ] `README.md`, `LICENSE`, `SECURITY.md`, all package license metadata, CODEOWNERS/governance/support files, GitHub settings, labels, and remote issues are unchanged; the documentation diff is limited to the six paths in the affected-files table.
- [ ] `git diff --check`, `pnpm format:check`, and `pnpm agent:check` pass from the implementation worktree, and a manual schema/path review against current GitHub documentation finds no unsupported Issue Form field or template location.

Together these checks define one completion condition: a review-ready documentation pull request contains the three requested community-health capabilities as accurate, discoverable German contributor guidance in GitHub-supported locations, while MIT licensing and all unrelated repository or remote state remain unchanged.

## Validation plan

- Compare the implementation base and final diff for the six affected paths, and separately verify that `README.md`, `LICENSE`, `SECURITY.md`, and the root/backend/frontend package `license` fields did not change.
- Check the Issue Form files against GitHub's current schema: required top-level keys, non-empty bodies, unique identifiers, supported element types, valid required-field declarations, and no references to nonexistent labels or assignees.
- Manually resolve every local Markdown reference from `CONTRIBUTING.md`, the code of conduct, the Issue Forms, and the PR template; reject hard-coded links to the deprecated repository name.
- Run `git diff --check` and `pnpm format:check` for whitespace and formatting defects.
- Run `pnpm agent:check`, the repository's established local delivery gate, and report pre-existing or environment-dependent failures separately from regressions caused by these files.
- Post-merge follow-up, outside the documentation pull request's completion gate: inspect the GitHub new-issue chooser, a new pull request body, and the Community Health profile. Record the observed recognition and score without changing repository visibility or other settings. If live recognition fails, use a read-only `effective-flow investigate` follow-up; any repository correction requires a separate Documentation change.

## Assumptions and open points

- Verified repository context: the four existing community-health baseline files and package manifests consistently retain MIT; the requested three capabilities are absent; the only open GitHub issue is the unrelated #1; and current GitHub documentation supports the planned root and `.github/` paths.
- External context: the user reported a 62% Community Health score, and the authenticated API returned the same value for the canonical repository on 2026-08-28. The three missing capabilities are desirable but not required for MIT publication.
- User-confirmed policy decision: `security@sebastian-software.de` is authorized to receive and coordinate confidential code-of-conduct reports.

## Plan review

**Result:** Approved

### Summary

| Area            | Critical | Important | Note |
| --------------- | -------: | --------: | ---: |
| Architecture    |        1 |         1 |    0 |
| Security        |        1 |         0 |    0 |
| Data protection |        0 |         0 |    0 |
| Error cases     |        0 |         0 |    0 |
| Testability     |        0 |         1 |    1 |
| Scope           |        0 |         0 |    0 |
| Maintainability |        0 |         1 |    0 |

### Findings

- **Critical — Security (resolved):** Repository evidence proved only that `security@sebastian-software.de` is the monitored vulnerability channel. The maintainer confirmed on 2026-08-27 that the mailbox is also authorized to receive and coordinate confidential code-of-conduct reports, and the plan now records that contact explicitly.
- **Critical — Architecture (resolved):** The initial plan delegated the material enforcement-ladder decision to the implementer. The plan now requires the official Contributor Covenant 3.0 enforcement and remediation ladder unchanged, leaving implementation no governance discretion.
- **Important — Architecture (resolved):** A relative or repository-variable-backed `contact_links` URL is not supported by GitHub's chooser configuration. The plan now limits `config.yml` to disabling blank issues and keeps security routing inside the forms, avoiding both an invented destination and a rename-sensitive hard-coded URL.
- **Important — Testability (resolved):** Live GitHub recognition occurs only after merge to the default branch, beyond the Documentation workflow's review-ready-PR completion boundary. It is now a post-merge follow-up rather than an acceptance gate.
- **Important — Maintainability (resolved):** The code-of-conduct source was described only as current. The plan now pins the official German Contributor Covenant 3.0 source and its version-matched attribution and defines drift as a stop condition.
- **Note — Testability (resolved):** A merge-gate workflow cannot diagnose a recognition failure after merge. The follow-up now routes to read-only investigation, with any corrective documentation handled as a separate change.

### Deep interactive review — 2026-08-27

No further directly incorporable or decision-requiring findings were identified. The governance policy, confidential reporting contact, template URL constraints, delivery boundary, and post-merge verification path are fully resolved.

## Open points

- No open points.

## Test results

- `git diff --check` passed before and after the repository-wide validation.
- Both Issue Forms parsed successfully and passed checks for required top-level keys, supported body elements, non-empty required attributes, unique field identifiers, boolean validation flags, the planned required-field sets, and the absence of labels and assignees.
- The issue chooser configuration matched exactly `blank_issues_enabled: false`, and both rendered `../security/policy` targets resolved to the repository security policy.
- All repository-relative Markdown links and anchors resolved, and the pull request coordination guidance matched `CONTRIBUTING.md`.
- The Contributor Covenant structure, all four enforcement levels, authorized reporting contact, attribution, and removal of editorial placeholders passed focused validation against the official German 3.0 source.
- `README.md`, `LICENSE`, `SECURITY.md`, and the root, backend, and frontend package manifests remained byte-identical to canonical base `80312f4`.
- A fresh `pnpm agent:check` passed: formatting, type checking, builds, 162 backend tests, and 253 frontend tests succeeded. It reported only 10 pre-existing backend spelling warnings and 7 pre-existing frontend compatibility warnings.
- The first sandboxed formatter attempt could not verify pnpm's registry signature because network access was unavailable; the unchanged command was rerun with network access and passed without bypassing the signature check.
- Validation introduced no generated working-tree changes. It ran with the available Node.js 26.3.0 rather than the documented Node.js 24.18.0; all checks passed. Live GitHub template recognition and the Community Health refresh remain the planned post-merge observation.

## Review findings

The initial content review found two important issues: the Issue Form security links did not resolve correctly in GitHub's rendered context, and the pull request template did not state the existing conditional coordination requirement. Both were corrected in the first bounded correction round.

A later delivery check found a critical repository-target error: the original pull request had been opened against `sebastian-software/relanto-deprecated`. The change was rebuilt from canonical `sebastian-software/relanto` `main`; every remote reference and repository-state claim in this archived plan was corrected before the replacement pull request was created. Final validation and review results are recorded below.

A fresh final review against the official Contributor Covenant 3.0 source, GitHub's current Issue Form and pull request template documentation, the canonical repository state, and the complete staged diff found no remaining critical or important findings.
