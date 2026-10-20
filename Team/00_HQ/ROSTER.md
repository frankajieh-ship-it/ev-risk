# Roster & Ownership

| Role | Folder | Owns | Final say on |
|---|---|---|---|
| **CEO & Product Owner** | `03_Roles/CEO` | Vision, priorities, customer validation, revenue | Everything not delegated below; cross-team conflicts |
| **Technical Lead** (Member 1) | `03_Roles/Tech-Lead` | Architecture, agent orchestration, backend integration, deployment | How it's built, what ships to prod, infra and cost limits |
| **EV Data & Intelligence Lead** (Member 2) | `03_Roles/Data-Intel-Lead` | Vehicle matching, listing analysis, VIN research, pricing, evidence quality | Whether a data source or claim is trustworthy enough to show buyers |
| **Product & UX Lead** (Member 3) | `03_Roles/Product-UX-Lead` | Buyer journey, interface, saved vehicles, reports, usability testing | What the buyer sees and in what order |
| **Growth & Commercial Lead** (Member 4) | `03_Roles/Growth-Lead` | Buyer interviews, Reddit/community research, acquisition, pricing, conversion | Channel strategy, messaging, pricing proposals (the CEO approves the price) |

## Escalation
Stuck for more than a day, or two leads disagree: put it on `01_Comms/BOARD.md` tagged `@CEO`. The CEO decides within 48h and logs it in `DECISIONS.md`.

## Common handoff paths
- Growth → Product: interview findings that change the buyer journey
- Data → Tech: data contracts and schemas a tool depends on
- Product → Tech: UI specs and acceptance criteria
- Tech → Data: data-quality issues found in production
