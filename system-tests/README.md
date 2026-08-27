# System tests

`system-tests/` owns shared Budget scenarios and tests that cross product or process boundaries.

`system-tests/support/` contains the deployment-neutral scenario corpus and packed-package helpers. `system-tests/postgresql/` tests durable behavior against disposable PostgreSQL. `system-tests/cloud/` starts the private service against a database installed through the packed PostgreSQL command.

Write new system-test records under `artifacts/system-tests/`. PostgreSQL and Cloud system passes do not prove managed providers, paid infrastructure, backup, recovery, failover, security qualification, or production readiness.
