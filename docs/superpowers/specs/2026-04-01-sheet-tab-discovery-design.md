# Sheet Tab Discovery Design

## Goal

Allow admins to paste a Google Sheet URL, auto-discover the available tabs, select the relevant tabs, and save multiple per-tab sheet sources for a single agent.

## Current Constraints

- `agent_sheet_sources.agent_id` is unique, so one agent can only have one source.
- A source reads one tab only, either from `sheet_tab_name` or inferred from `gid`.
- The admin UI uses a free-text `Sheet Tab Name` field instead of tab discovery.

## Proposed Design

### Data Model

- Remove the one-source-per-agent restriction.
- Add spreadsheet identity fields to `agent_sheet_sources` so a source is tied to a specific spreadsheet and tab:
  - `spreadsheet_id`
  - `sheet_gid`
- Enforce uniqueness per `agent_id + spreadsheet_id + sheet_tab_name` so the same tab cannot be added twice for the same agent.
- Keep each selected tab as its own source row so sync status, pending rows, and errors stay isolated per tab.

### Backend API

- Add a discovery endpoint that accepts a Google Sheet URL and returns:
  - spreadsheet identity
  - discovered tabs with `gid` and `title`
- Update create-source behavior to accept multiple selected tabs in one request.
- Preserve existing sync behavior: sync still runs per source, but an agent may now have multiple sources.

### Admin UI

- Replace free-text tab entry with a discovery flow:
  - select agent
  - paste Google Sheet URL
  - click discover
  - render discovered tabs with checkboxes
  - submit selected tabs
- Keep edit/update support for a single saved source.
- Show the tab clearly in saved source cards and recent activity.

### Sync Behavior

- Each selected tab becomes one source row.
- Sync all processes every active source.
- Multi-country support remains row-driven: each row may specify `marketplace`/`country`, and country-specific tabs are naturally supported by keeping one tab per source.

## Error Handling

- Invalid sheet URL: inline validation error.
- Missing Google credentials: existing server-side 503 behavior remains.
- Metadata lookup failure or inaccessible spreadsheet: return readable error from discovery endpoint.
- Duplicate tab selection for an agent: return a targeted duplicate-source error.

## Testing

- Unit tests for Google Sheet tab discovery.
- Unit tests for multiple source creation and duplicate protection.
- API tests for the discovery endpoint and multi-tab create flow.

