# Case Studies

Case studies are public-facing narratives derived from approved portfolio project records.

## Source of truth

The project record is the factual source for:

- ownership
- role
- scope
- deliverables
- evidence
- outcomes
- publication permissions

A case study must not introduce facts that are absent from or unsupported by the project record.

## Required project reference

Every case study must identify the exact source project record before it can be treated as publication-ready.

Include both metadata fields at the top of the case-study file:

`**Project ID:** project-name`  
`**Project record:** ../projects/project-name/project.md`

The Project ID must match the canonical Project ID in the referenced project record. The project record path must resolve to that project's `project.md`.

The project directory name is the canonical identifier for the project record. Do not silently rename it; update the case-study reference and other dependent references in the same reviewed change when a rename is genuinely required.

## Workflow

1. Complete the project record, including its canonical Project ID.
2. Review evidence and permissions.
3. Draft the case study from the approved facts.
4. Add the matching Project ID and exact Project record path.
5. Verify every material claim against the referenced project record.
6. Confirm the Project ID and referenced path resolve to the same canonical project.
7. Mark the case study ready for publication only after review.

## File naming

Use lowercase kebab-case filenames.

Use the project ID as the case-study filename prefix:

`project-name-case-study.md`

Example:

`modern-business-site-case-study.md`

The filename, Project ID, and referenced project directory should all identify the same project.
