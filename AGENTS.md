# Codex Rules

## Workflow

For every feature:

1. Split work into phases
2. Complete one phase
3. Review changes
4. Commit phase
5. Continue next phase

Never create one giant final commit.

## Commit format

Use:

feat: ...
fix: ...
refactor: ...
test: ...
docs: ...

## Before commit

Run:

git status
git diff

Check your changes.

## After finishing task

Update CHANGELOG.md with:
- what changed
- commits created
- important notes

Then push.

## Safety

Never:
- force push
- commit secrets
- modify unrelated files