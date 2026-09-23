# Releases and retained evidence

This page owns the release procedure and the durable evidence needed to support a release claim. The repository currently builds private, unpublished archives; it has no configured registry publication command. Publishing, changing hosted settings, or claiming production readiness requires a separately authorized release change.

The [testing reference](../testing.md) owns current commands and the meaning of each verification lane. Package guides own supported APIs, runtime configuration, and limits. The [contributor workflow](../workflow.md) owns feature review and merge.

## Prepare a candidate

1. Select one clean commit and record its full SHA. Use the supported Node.js and pnpm versions with a frozen lockfile.
2. Confirm the intended package versions, public entrypoints, generated contracts, license, package contents, and package-to-package version compatibility.
3. Run the applicable provider-free checks from the testing reference. Fix the candidate and restart evidence collection if source, generated output, dependencies, or documentation changes.
4. Produce one archive set from the selected commit. Record every filename and SHA-256 digest before qualification.
5. Run the exact-archive lane against those bytes. Run native, external, operating-system, Node.js, security, recovery, or performance lanes only when the release claim needs them.
6. Review every report, cleanup result, exclusion, and `NOT RUN` lane. A failed or incomplete attempt cannot qualify a release.
7. Create `docs/releases/<release>/` only for an accepted release candidate and retain the essential public-safe evidence described below.
8. Publish only the qualified archive bytes. Repacking or rebuilding creates a different candidate and requires new archive digests and affected qualification.
9. Read back the published metadata and archive, verify its digest, and record the immutable registry identity. Publication success alone does not prove installation or behavior.

Because publication is not configured, the current procedure stops after an accepted candidate record. Add registry authentication, provenance, signing, tagging, and rollback steps only when a concrete distribution target is approved.

## Release record

Keep the smallest record that makes the accepted claim independently auditable after CI artifacts expire. A release directory contains a short `README.md` and only the essential sanitized reports it references.

Record:

- release identifier and disposition;
- full source commit and clean-before/clean-after observations;
- lockfile, generated contract, installation record, and archive SHA-256 digests that apply;
- exact commands and relevant environment versions;
- package filenames, versions, entrypoints, and tested consumer combinations;
- passed, failed, skipped, unavailable, and `NOT RUN` lanes;
- native target class and TLS facts without credentials;
- report filenames and their hashes;
- cleanup outcomes and any operator-owned cleanup;
- reviewer acceptance and immutable publication identity when publication occurs.

Retain the actual essential report with its checksum. A checksum, workflow URL, PR comment, or artifact identifier without the report is insufficient. Do not retain raw build caches, duplicate package archives, credentials, customer data, full feature plans, or a second mutable release-status database.

## Claim boundaries

- Source tests qualify source behavior, not packed or published bytes.
- Package tests qualify only the archive digests they installed.
- Native PostgreSQL results qualify only the observed PostgreSQL profile and covered scenarios.
- External target evidence does not become a managed Hosted claim.
- An operating-system or Node.js matrix proves only its listed cells.
- Historical evidence remains attached to its recorded revision; it does not advance with a branch.
- CI artifacts are transport for review, not durable release evidence.
- A version tag or registry upload is identity evidence, not proof of behavior or production readiness.

If a claim cannot be supported by the retained record, narrow the claim or mark the missing lane `NOT RUN`.
