# OFFO Team Workspace

The shared home for the OFFO team. If you're unsure where something goes, use this page.

| Folder | What goes here | Who writes |
|---|---|---|
| `00_HQ/` | Priorities, decisions, roster: the source of truth | CEO (others propose) |
| `01_Comms/` | Announcements, weekly syncs, the request board, handoffs | Everyone |
| `02_Projects/` | One folder per initiative: brief, status, specs | Project owner + contributors |
| `03_Roles/` | Each lead's working area: drafts, notes, scratch | That role's owner |
| `04_Research/` | Buyer interviews, community research, market/competitor intel | Growth + Data, all read |
| `05_Assets/` | Brand, decks, screenshots, media | Everyone |
| `06_Legal/` | Contracts, NDAs, agreements | CEO only |
| `_templates/` | Copy these, don't edit them | CEO |
| `99_Archive/` | Old material from before the Oct 2026 restructure. Read-only | — |

## How we communicate

1. **Need something from another lead?** Add a row to `01_Comms/BOARD.md`. If it's more than a sentence, write a handoff in `01_Comms/handoffs/` using `_templates/handoff.md`.
2. **Weekly update:** every lead adds their section to `01_Comms/weekly-sync/YYYY-MM-DD.md` by **Friday EOD**. The CEO publishes the next week's file on Monday.
3. **Decisions:** nothing counts as decided until it's in `00_HQ/DECISIONS.md`. Propose with `_templates/decision.md`; the CEO accepts or rejects.
4. **Company-wide news:** only in `01_Comms/ANNOUNCEMENTS.md`, newest first.

## Rules

- **Finished work goes in `02_Projects/`, work in progress goes in `03_Roles/`.** If someone else needs it, it isn't a draft anymore.
- **Name files `YYYY-MM-DD_short-name.md`** for anything dated (interviews, syncs, handoffs). Lowercase, hyphens, no spaces.
- **Use Markdown** for anything people will edit or diff. Binaries (pptx, docx, mp4) go in `05_Assets/`.
- **Never put credentials, API keys or customer PII in this folder.** It's committed to git. Store interview notes with first names or initials only.
- **Code lives in the repo, not here.** Link to files and PRs instead of pasting code.
