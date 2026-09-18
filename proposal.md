# Proposal: A modular, embeddable PostgreSQL-compatible runtime

Status: Research proposal. No implementation, performance results, or compatibility qualification is claimed.

Date: 2026-09-18

## Thesis

Applications should be able to use PostgreSQL semantics without carrying every capability of a general-purpose database server. A developer should be able to embed a database, select the features the application needs, and optionally compile known workloads into a smaller runtime.

This proposal explores a standalone open-source project for that purpose. The intended audience includes local-first applications, browser tools, edge workloads, test infrastructure, and applications that need transactional storage inside their process. These are candidate audiences, not validated demand. Keynes could provide one test workload, but its architecture and delivery schedule do not govern this project.

The central research question is whether a small, carefully specified interpreter can support useful PostgreSQL behavior and generate specialized database runtimes without maintaining separate implementations of their semantics.

The project would pursue three measurable outcomes: lower startup cost, lower memory use, and smaller distributed artifacts. Faster query execution is another hypothesis to test. No language or compiler technique guarantees all four improvements.

## The opportunity and existing work

[PGlite](https://pglite.dev/) brings PostgreSQL to WebAssembly and advertises a compressed build under 3 MB, with dynamically loaded extensions. Its use of PostgreSQL provides substantial compatibility value. Compressed download size, installed size, initialized memory, and time to the first useful transaction remain separate measurements.

[Turso](https://github.com/tursodatabase/turso) already provides a Rust database engine with an experimental PostgreSQL frontend over shared storage, compilation, and execution machinery. Its PostgreSQL frontend is relevant prior art and a possible foundation. Supporting a dialect and protocol does not by itself establish PostgreSQL transaction or stored-procedure compatibility.

[LingoDB](https://www.lingo-db.com/) explores extensible query compilation with MLIR, while [Feldera](https://docs.feldera.com/sql/intro/) compiles SQL into Rust for incremental computation. These demonstrate useful compiler approaches. Neither supplies the complete embedded transactional contract proposed here.

The project's reason to exist would be a demonstrated combination of selective packaging, explicit PostgreSQL compatibility, and workload specialization. The first investigation must consider contributing those capabilities to an existing engine. An independent engine is justified only if existing foundations prevent the experiment or retain unacceptable overhead.

## Two execution modes

### Modular dynamic execution

An application selects a supported feature profile and executes SQL dynamically within it. The runtime includes the parser, type resolution, operators, and storage capabilities required by that profile.

Modules could cover JSON operations, additional scalar types, text functions, persistence, or network access. Each module declares its dependencies. Transaction correctness and validation are mandatory for every supported configuration.

The prototype should expose a few tested profiles rather than promise arbitrary combinations. Unsupported syntax or features produce explicit errors before a statement changes state.

### Compiled execution

An application supplies its schema and known operations during its build. The compiler resolves their dependencies and emits a specialized native library or WebAssembly module. Query parameters and table contents remain runtime inputs.

```text
Schema + supported SQL operations
                 |
       Parse, resolve, and validate
                 |
          Typed database bytecode
                 |
       +---------+----------+
       |                    |
 Dynamic interpreter   Build-time specialization
       |                    |
 General execution     Specialized operations
       +---------+----------+
                 |
       Shared transaction semantics
```

An unrestricted SQL entrypoint requires retaining everything that future accepted SQL can invoke. Ordinary JavaScript tree shaking cannot infer those dependencies inside a prebuilt WASM module. Automatic workload-based removal therefore requires a declared workload and a database-aware build step.

Schema or operation changes invalidate the corresponding compiled artifact. The artifact must identify the schema, feature profile, compiler version, and semantic version it was built against. A mismatch fails explicitly. It must not silently execute a stale plan.

## Compatibility is the product contract

The project would target a documented subset of a pinned PostgreSQL version. Compatibility would be tracked independently for syntax, types, expressions, constraints, transactions, errors, procedures, and client protocols.

The initial prototype would cover an in-memory database with table creation, primary and unique keys, inserts, updates, deletes, indexed reads, and explicit transactions. It would include a small type set with defined NULL, cast, comparison, and decimal behavior. The exact SQL grammar and arithmetic limits must be written before implementation.

The first transaction model would permit one active transaction per database instance. This makes atomicity and rollback testable without claiming PostgreSQL's concurrent isolation behavior. Concurrency would require a separate specification and qualification milestone.

The prototype would not claim compatibility with PostgreSQL extensions, its on-disk format, full system catalogs, arbitrary PL/pgSQL, roles, replication, or crash recovery. Durable storage and concurrent transactions are future research stages, not optional flags over an unqualified implementation.

The engine must preserve errors as well as successful results. Exact numeric rounding, duplicate handling, statement failure, and transaction failure states belong in the supported contract. Replacing an unsupported operation with approximately similar behavior is not compatibility.

## Language choice

Rust is the proposed baseline, with Zig as the main alternative. The choice remains open until a bounded experiment compares the same workload and semantics.

| Language | Strongest role | Main tradeoff |
| --- | --- | --- |
| Rust | Runtime, transactions, portable execution, and verified components | Ownership supports explicit boundaries, but low-level storage still needs careful memory design and potentially audited unsafe code. |
| Zig | Compact runtime, explicit allocation, and compile-time specialization | Direct control and C integration are attractive. Memory-lifetime correctness requires more manual discipline. |
| C++ | Compiler work built closely around LLVM, MLIR, or TPDE | Direct access to compiler infrastructure, with a larger manual memory-safety burden. |
| Mojo | Experimental vectorized or accelerator execution | Worth a focused execution-kernel experiment. Tooling and target support need qualification before a broader commitment. |
| Lean and verification languages | Specifications, semantic models, and proofs | Useful alongside the runtime. Proof effort and tool restrictions limit how much can be verified initially. |

[Zig's documented facilities](https://ziglang.org/documentation/master/) include explicit allocators, compile-time execution, and WebAssembly targets. [TigerBeetle](https://docs.tigerbeetle.com/single-page/) demonstrates its use in a serious database system. Neither establishes a performance advantage for this workload.

[Mojo](https://mojolang.org/docs/manual/) is a candidate for experimental execution kernels. Introducing another language must earn its build, debugging, and distribution cost through measured benefits.

PostgreSQL is already written in C. A Rust or Zig rewrite is not inherently a speed improvement. Expected gains come from narrower execution requirements, memory layout, specialization, and moving work out of runtime initialization.

## Experimental tools and their purpose

### A shared interpreter and partial evaluation

The preferred first experiment uses a small typed bytecode interpreter as the executable definition of supported behavior. Dynamic queries compile to bytecode. Known bytecode programs can then be specialized.

[weval](https://github.com/bytecodealliance/weval) partially evaluates WebAssembly interpreters using known program inputs. The experiment would test whether schema and query bytecode can become constants while table contents and parameters remain dynamic.

The expected benefit is removing dispatch and generic operations without hand-maintaining another executor. Risks include code growth, long specialization times, unsupported interpreter patterns, and differences introduced by compilation. The same correctness corpus must run through interpreted and specialized execution.

### Alternative query compiler backends

[Cranelift](https://cranelift.dev/) offers an established native code-generation path. [TPDE](https://arxiv.org/abs/2505.22610) researches fast compilation from existing intermediate representations, including database workloads. [LingoDB](https://www.lingo-db.com/) provides an MLIR-based reference for layered query compilation.

These are alternative experiments, not a requirement to integrate every compiler. Compare compilation latency, executable size, generated-code performance, and implementation effort. A substantial build-time compiler may be acceptable even when a substantial runtime compiler is not.

### Optimizer research

[egglog](https://github.com/egraphs-good/egglog) combines equality saturation with Datalog-style reasoning. It could represent equivalent query expressions and select an implementation through a cost model.

The first experiment would use a bounded expression subset and explicit resource limits. SQL rewrites must account for NULLs, duplicates, errors, and function volatility. Algebraic equality over ordinary numbers is insufficient evidence for a SQL transformation.

### Preinitialization and artifact reduction

[Wizer](https://github.com/bytecodealliance/wizer), whose development has moved into Wasmtime, snapshots initialized WebAssembly state. [Binaryen](https://github.com/WebAssembly/binaryen) can optimize WASM and remove unreachable code.

Candidate experiments include preinitializing type tables or a known empty schema, followed by removal of initialization-only code. Snapshots may increase artifact size. Runtime-specific resources, clocks, and randomness must be initialized per instance rather than accidentally captured and reused.

Native and WebAssembly builds are separate qualification targets. A browser build does not need an embedded Wasmtime runtime. Browser persistence and native file I/O also require different host integrations.

### Verification and failure exploration

[Verus](https://github.com/verus-lang/verus) and [Aeneas](https://github.com/AeneasVerif/aeneas) offer different approaches to verifying Rust code. An initial trial should prove one useful property, such as decimal overflow behavior, index ordering, or a transaction state transition. The proof must name its assumptions and implementation boundary.

AI tools may propose specifications, tests, or proof steps. Machine checking can validate a proof against a specification, but it cannot establish that the specification expresses the intended database behavior.

The runtime should make I/O, scheduling, time, and randomness controllable by a deterministic simulator. [TigerBeetle's simulation work](https://tigerbeetle.com/blog/2026-08-20-protocol-aware-dst/) and [Turso's simulator](https://github.com/tursodatabase/turso/blob/main/testing/simulator/README.md) provide references. Simulated failures become especially important when persistence and concurrency enter scope.

[SQLancer](https://github.com/sqlancer/sqlancer) provides techniques for discovering query logic bugs. Differential tests against PostgreSQL provide complementary evidence. Comparison must respect unordered results, declared nondeterminism, and the supported type and SQL subset.

## Reuse before reimplementation

[libpg_query](https://github.com/pganalyze/libpg_query) exposes PostgreSQL's parser outside the server. Evaluate it before writing a grammar. It does not supply catalog resolution, type checking, planning, or execution semantics. Its footprint and target support also need measurement.

Investigate Turso's execution model and extension boundaries before creating storage machinery. Reusing a storage library can save implementation work, but the project still owns the mapping between SQL behavior and that library's transaction guarantees.

The prototype should avoid simultaneously inventing a grammar, storage format, optimizer, compiler, and proof framework. The first distinctive experiment is specialization of correctly interpreted operations.

## Research milestones

| Stage | Deliverable | Decision supported by evidence |
| --- | --- | --- |
| 1. Establish the need | Three unrelated candidate applications, a supported-workload definition, PGlite measurements, and an assessment of existing engines | Is there a recurring need, and can an existing project support it? |
| 2. Compare language costs | The same small interpreter and indexed transactional workload in Rust and Zig | Which implementation offers the best footprint, clarity, tooling, and contribution experience? |
| 3. Establish semantics | One interpreter, a published compatibility matrix, and a PostgreSQL differential corpus | Is the supported subset useful and reliable enough to justify specialization? |
| 4. Test specialization | One workload compiled through weval, measured against interpreted execution | Does specialization improve the intended metrics without unacceptable code growth or build cost? |
| 5. Test advanced tooling | One verified component and one bounded compiler or optimizer comparison | Which experimental tools earn continued investment? |
| 6. Publish a research preview | Reproducible builds, benchmarks, failures, supported profiles, and native and WASM examples | Can independent users reproduce the claims and contribute meaningful workloads? |

These are research gates, not release dates. A negative result is a useful deliverable. If specialization offers little benefit, the project should narrow its scope or contribute findings upstream.

## Measurement and acceptance

Benchmarks must separate compressed bytes, installed bytes, initialized memory, peak memory, startup, compilation, and steady-state execution. Memory measurements should include one instance and many independent instances.

Execution tests should include short indexed transactions, repeated prepared operations, bounded joins, and a workload selected by an external adopter. Analytical throughput alone cannot establish suitability for embedded transactional applications.

Every comparison must record hardware, operating system, engine revision, feature profile, build settings, data sizes, and whether parsing, initialization, and compilation are included. Compare equivalent guarantees: an ephemeral single-transaction prototype must not claim superiority over durable concurrent execution based on unequal work.

Correctness gates include rollback, constraint failures, exact arithmetic, and parity between interpreted and specialized paths. Retain failing seeds and minimized reproductions. Passing a corpus supports the covered behavior and revision; it does not prove complete PostgreSQL compatibility.

After baseline measurements, declare numerical improvement targets before evaluating optimization results. No speedup or footprint target is presented here as an achieved result.

## Community scope and decisions still open

The proposed distribution is a permissively licensed open-source library with reproducible builds and public compatibility evidence. The exact license requires a dependency-license review. A separate repository and project name remain to be chosen.

Useful early contributions include application workloads, minimized semantic mismatches, portability fixes, and independent benchmark reproduction. Experimental backends should remain distinguishable from qualified behavior.

The unresolved decisions are whether to extend an existing engine, which audience determines the first SQL subset, whether Rust or Zig best fits the implementation, and how much specialization reduces real application overhead. Persistence, concurrent isolation, and stored procedures should receive separate proposals once the core experiment produces evidence.

The first commitment is a reproducible investigation of a modular interpreter and its specialized output. A generally available database follows only if the results justify the compatibility and maintenance burden.
