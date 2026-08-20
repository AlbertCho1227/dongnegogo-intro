# DongNeGoGo Web lane

- This repository owns the public web site and its hosting build only.
- Read only the affected route/components/tests first; do not pull backend or
  mobile history into a local Web task.
- Preserve approved branding/layout unless the request explicitly changes it.
- Keep runtime secrets server-only and never put credentials in source, assets,
  logs, or handoffs.
- Build from a clean current source tree; do not deploy stale `dist` artifacts.
- External publish, DNS, and hosting changes need their own explicit approval.
- End with a six-line handoff: status, changed files, decision, verification,
  risk, next action.

For multi-repository coordination, see
`../docs/CODEX_OPERATING_MODEL.md`.
