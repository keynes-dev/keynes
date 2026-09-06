# Planning replacement review

This replaces the earlier local planning review. It records document review only;
it does not establish runtime, simplification, performance, or acceptance results.

The replacement removes the proposed binding subclass, acquisition/cleanup workers,
reconciliation, disabled Ryuk, and custom forced-loss cleanup guarantee. It makes
Testcontainers conditional on the complete simplification and operational gates.

The task list starts with measurements, then removes package and fixture duplication,
then pilots/replaces/deletes lifecycle code, and ends with whole-result review and
acceptance. The fallback removes the pilot and qualifies reductions using Docker.
Both outcomes must reduce total maintained testing code and preserve unique product
assertions. Five runs per timed command and revision use a 10% median limit.

The source/packed distinction applies to installation only. Existing source installer
and SDK tests do not become installed-consumer evidence. Package identity and existing
immutable reports remain owned by their current helpers.

The Linear issue was renamed and read back with branch
`key-60-simplify-native-postgresql-testing`. The existing directory remains selected.
Detailed artifacts are local-only; no implementation, runtime measurement, publication,
or acceptance has occurred in this planning replacement.
