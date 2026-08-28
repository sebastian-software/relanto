# Effective-Flow-Projektsetup

## Status

Aktiv

## Kontext

Diese ADR enthält die versionierte Effective-Flow-Konfiguration dieses Projekts. `.effective-flow/` ist ein reines Laufzeitverzeichnis und vollständig von Git ausgeschlossen.

## Konfiguration

| Schlüssel                         | Wert                       |
| --------------------------------- | -------------------------- |
| review.profile                    | focused                    |
| review.autoConfirmScope           | false                      |
| review.designDecisionSources      | standard                   |
| review.validation                 | full                       |
| applyReview.defaultCommitStrategy | null                       |
| applyReview.finalValidation       | full                       |
| applyReview.stashPolicy           | interactive                |
| applyReview.worktree.baseDir      | .effective-flow/.worktrees |
| applyReview.worktree.setup        | auto                       |
| language.project                  | de                         |
| language.workflow                 | en                         |
| plan.dir                          | docs/plan                  |
| delivery.baseBranch               | origin/main                |
| delivery.branchPrefix             | firmo                      |
| delivery.completion               | pr                         |
| delivery.returnBranch             | auto                       |
| delivery.prReview                 | always                     |
| mergeGate.completion              | merge                      |
| mergeGate.bots                    | recensor                   |
| mergeGate.bots.recensor.trigger   | /recensor review           |
| mergeGate.bots.recensor.check     | recensor/review            |
| worktree.enabled                  | true                       |
| worktree.setup                    | auto                       |
| worktree.baseDir                  | .effective-flow/.worktrees |
| tracker.mode                      | remote                     |
| tracker.remoteToolOverride        | auto                       |
