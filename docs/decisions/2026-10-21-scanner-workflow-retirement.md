# Scanner Workflow Retirement Decision

**Status:** Founder-authorised proposal; awaiting pull-request review and merge  
**Date:** 2026-10-21  
**Owner:** Founder

## Context

The repository contained three GitHub Actions workflows that did not provide dependable, repository-specific security coverage:

- `.github/workflows/sonarqube.yml` had an empty SonarQube project key, did not check out the repository, and depended on an undocumented self-hosted SonarQube endpoint.
- `.github/workflows/sonarcloud.yml` had empty project and organisation arguments and represented a broken CI-based analysis path. A SonarCloud GitHub App analysis was observed on PR #55, but the project's Automatic Analysis setting has not been independently verified.
- `.github/workflows/apisec-scan.yml` targeted the vendor's `VAmPI` demo API rather than this application's API. The available evidence did not establish successful import of scan results for this application.

The original scanner workflow failures occurred repeatedly. Exact underlying runtime causes remain unverified where workflow logs were inaccessible. This decision does not claim otherwise.

## Question

Should these workflows remain enabled, be repaired immediately, or be retired while a repository-specific security plan is decided separately?

## Options considered

1. **Keep the workflows unchanged.** Rejected because the configured jobs were nonfunctional or did not target this application, creating unreliable signals rather than demonstrated coverage.
2. **Repair and retain all three immediately.** Deferred because the repository does not currently establish the required self-hosted SonarQube endpoint/project configuration or a valid APIsec target for this application. Rebuilding those integrations without verified configuration would require assumptions.
3. **Retire the three workflows and track genuine coverage gaps separately.** Selected. This removes the known misleading/broken workflow definitions without choosing new vendors, inventing target infrastructure, or expanding the change into application code.

## Decision

Propose deleting only these workflow files:

- `.github/workflows/sonarqube.yml`
- `.github/workflows/sonarcloud.yml`
- `.github/workflows/apisec-scan.yml`

The change is recorded in [PR #55](../../../../pull/55) and remains subject to PR review and merge. No deployment, provider activation, secret change, repository setting change, or branch-protection change is part of this decision.

## Consequences and boundaries

- The broken self-hosted SonarQube CI workflow and the mis-targeted APIsec demo scan will no longer run from these workflow definitions.
- The SonarCloud GitHub App produced a passing analysis comment on PR #55. That observation is not proof that Automatic Analysis is enabled or that future analyses will continue; the project setting remains to be verified.
- PR #55 also reported successful Dependency Review, CodeQL Advanced, Codacy Security Scan, Snyk commit status, and a passing SonarCloud PR quality gate. These checks do not establish runtime API security coverage.
- **Runtime API security testing remains an open gap.** The retired APIsec workflow did not demonstrate testing against this application's API. A separate decision must define the real target, authentication/test-data boundaries, specification or test approach, tool, ownership, and acceptance criteria before runtime testing can be implemented.
- No vendor, budget, staging environment, credentials, or API specification is selected or assumed here.
- Provider linkage and deployment triggers have not been conclusively audited; retiring these GitHub workflow files must not be represented as proof that no external automation exists.

## Verification and limitations

The PR diff was checked against its base and contained exactly the three intended workflow deletions, with no application source changes. The current PR checks reported successful Dependency Review, CodeQL Advanced, Codacy Security Scan, Snyk status, and SonarCloud PR analysis. Workflow semantic linting with `actionlint` was not performed because that tool was unavailable in the review environment. The inaccessible original workflow logs prevent a conclusive root-cause diagnosis of every past failure.

## Approval state

The Founder authorised publication of the retirement proposal. This document and PR #55 do not authorise merging, deployment, provider activation, or production changes.
