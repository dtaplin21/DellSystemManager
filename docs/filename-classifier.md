# Filename Classifier Rules

## Phase 1 – Catalogue
- **Sample uploads** (`uploaded_documents/`):
  - `1752537892466-_Panel Seaming Secondary Area B 55-64.xlsx`
  - `1752619339108-10-001_SKAPS_GE112-180.pdf`
  - `1752619346350-10-001_SKAPS_GE112-180.pdf`
  - `1752689399833-10-001_SKAPS_GE112-180.pdf`
- **Placement whitelist**:
  - `panel placement`, `placement log`, `placement summary`, `placement checklist`, `placement audit`,
    `placement record`, `placement tracker`, `panel layout`, `layout map`, `layout verification`,
    `panel locations`, `panel location`, `location log`, `location map`, `panel grid`, `panel assignment`,
    `panel mapping`, `layout record`, `placement map`, `placement matrix`
  - Single-word boosters: `placement`, `layout` (ignored when part of `replacement`).
- **Non-placement blacklist**:
  - `panel_seaming`: `seam`, `seaming`, `seam log`, `weld`, `welding`, `trial seam`, `fusion weld`
  - `non_destructive`: `ndt`, `non destructive`, `non-destructive`, `air lance`, `vacuum box`,
    `vac-box`, `spark test`, `holiday test`
  - `trial_weld`: `trial weld`, `pre-qual weld`, `trial strip`
  - `repairs`: `repair`, `patch log`, `patch record`, `defect log`, `punch list`
  - `destructive`: `destructive`, `lab test`, `shear test`, `peel test`
- **Fallback**: When a filename matches neither list it defaults to **non-placement** and is skipped to avoid creating layout records from unknown content.

## Phase 2 – Workflow Integration
- `panelLinkingService` and `documentToPanelLinker` now run the classifier **before** reading the file, logging the decision and preventing layout creation when the gate rejects a file.
- `AsbuiltImportAI.importExcelData` performs its own safeguard check and records metrics. Placement files continue through the existing creation flow; non-placement files reuse the domain-specific ingestion path; skipped files return zero records with a classifier decision summary.
- Manual overrides:
  - `overrideDomain` or `forcePlacement` flags on the document metadata (JSON), or direct fields such as `manualDomain`, trigger the override path.
  - Overrides are passed through to `AsbuiltImportAI` so operations can force placement when needed.

## Phase 3 – Hardening & Monitoring
- **Unit tests** (`tests/filenameClassifier.test.js`) cover positives, negatives, fallbacks, and overrides.
- **Manual QA scripts**:
  - `node backend/scripts/list-uploaded-filenames.js` – raw upload inventory.
  - `node backend/scripts/evaluate-filename-classifier.js` – classification summary with per-file reasoning.
- **Observability**: `AsbuiltImportAI` tracks totals, placement/non-placement counts, skips, overrides, and per-domain tallies. Metrics are logged via `📈 [AI][FilenameGate][Metrics]` in the import logs.

## Phase 4 – Iteration Readiness
- **Feedback hooks**: overrides accept `ingestionOverride.domain` and `forcePlacement` flags, allowing admins to push exceptions through the placement path immediately.
- **Stakeholders to sync with**: Field QA leads, document control, and panel installation supervisors (listed in `filenameClassifier.js`) so new naming conventions are reflected quickly.
- Re-run the QA script after any rule edits to verify shifts in categorisation.
