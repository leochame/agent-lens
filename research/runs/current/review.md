# Critic Review

## Verdict
- status: `blocked`
- reason: Required inputs are missing, so the draft cannot be evaluated against topic scope or mechanism quality.

## Required Inputs Check
- `research/AGENTS.md`: missing
- `research/runs/current/topic.md`: missing
- `research/runs/current/draft.md`: missing
- `research/runs/current/state.md`: missing at task start

## Why Blocked
- Cannot verify whether the稿件聚焦单一机制 because no `topic.md` and no `draft.md` are available.
- Cannot assess off-topic content, evidence sufficiency, mechanism chain, or overview repetition without source draft text.
- Cannot apply the repository-specific critic rubric from `research/AGENTS.md` because that file is absent.

## Actionable Unblock Steps
1. Add `research/AGENTS.md` (critic规范来源).
2. Add `research/runs/current/topic.md` (单一机制目标与核心问题).
3. Add `research/runs/current/draft.md` (待评审稿件).
4. Re-run critic step; expected outputs will be concrete `Must Fix / Should Fix / Remove / Keep` items tied to draft evidence.
