# Decisions

Use `>=24`, following docs/architecture.md. Reject bounded or even-major-only ranges because they contradict KEY-90.

Use setup-node's `latest` selector for the rolling lane. The existing action supports it: https://github.com/actions/setup-node . Keep major 24 as the minimum lane. This avoids a custom version-discovery script and a permanently stale numeric latest lane.

Retain per-consumer JSON through the existing qualifier's --output argument. No new evidence schema is needed. Keep the one-archive build and digest checks.
