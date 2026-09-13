# Playbook: start and end a session

Two agents (Claude Code, Gemini) work in this repo and can't see each other's sessions. This is the
shared protocol from `~/.claude/CLAUDE.md` / `~/.gemini/GEMINI.md`, applied to this repo.

## Start

```bash
git branch --show-current
git status --short
git log --oneline -10
```

1. Read `AGENTS.md`, then `docs/STATE.md`, then `CLAUDE.md` (the project brief; it applies to every
   agent despite the name).
2. Uncommitted changes you didn't make belong to someone else. Leave them alone: no staging,
   stashing, reverting or reformatting.
3. Files under STATE.md "In progress" that belong to the other agent are read-only for you.
4. Check the freeze in AGENTS.md §Hard rules before editing anything under `pipeline/`,
   `.github/`, `config/` or `data/`.

## Work

- Branch: `claude/<topic>` or `gemini/<topic>`, created from the branch the work belongs on
  (ask the user if you're unsure).
- Commit subject: `claude: <subject>` or `gemini: <subject>`. After the prefix, follow the repo's
  style: an area label and a plain sentence, e.g. `Events: add the Reserve Bank tightening cycle that
  began in July 2026`.
- Stage explicit paths (`git add <path> ...`), never `git add -A`, because other people's work may
  be in the tree.
- Architectural change → append to `docs/DECISIONS.md` first.
- Docs contradict code → stop and ask the user; record it under Blocked.

## End (non-negotiable)

Update `docs/STATE.md`:

- **Done**: what landed, with commit hashes.
- **In progress**: what is unfinished, **with every file touched**, and who owns it.
- **Next up**: in the user's order.
- **Blocked**: what is waiting on the user or on a date, and any contradiction found.
- The `Last updated by <agent> on YYYY-MM-DD` line.

Commit STATE.md even if nothing else was committed.

## Real example

The commit `chore: establish shared agent context` on branch `claude/shared-agent-context`
(2026-09-13) created this file and the first `docs/STATE.md`. It listed the uncommitted design work
on `ui/explore` as In progress, because that work was in the tree and not yet reviewed.
