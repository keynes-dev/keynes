# Evidence data

Extend the existing measurement record with startupMilliseconds, sampledPeakRssBytes and memorySampleCount arrays (30 entries), offlineInstallMilliseconds (5 entries), one steady batch elapsed time and derived requests/second (100 requests). Retain original raw fields and limits. Method identifies a 1 ms sampling interval; the peak is sampled and may miss synchronous allocation spikes. Offline installs use an isolated prefilled store and exclude downloads and type compilation.

Source commit and environment commit must match; revisions and digests must be valid, runtime must be observed node:sqlite and versions nonempty. Reject inconsistent method/counts, missing or nonfinite samples, zero throughput duration and incomplete evidence. New record version distinguishes added required fields. Records are written once only after limits pass.
