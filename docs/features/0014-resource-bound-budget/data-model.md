# Data model: Resource-bound Budget creation

## Resource schema

A `ResourceSchema` is a pure typed authoring value. It contains application keys, immutable definitions, and a digest. It has no connection, tenant, principal, Resource identity, or persisted state.

Only keys present in a root allocation take part in root creation. Unallocated definitions do not enter validation, replay identity, Resource storage, or history for that command.

## Root Resource input

Each command entry contains one canonical Resource definition and one non-negative safe integer amount.

| Field               | Rule                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| Canonical name      | Unique within the command and valid under the existing Resource-name profile |
| Unit                | Valid under the existing immutable Resource-definition profile               |
| Accounting behavior | `consumable` or `reusable`                                                   |
| Initial amount      | Non-negative safe integer under the existing amount limit                    |
| Application key     | SDK-only typed name; never enters the authority command                      |

The authority orders entries by canonical name before it computes the command body and digest.

## Resource type

A Resource type remains immutable and unique by tenant and canonical name.

| Field              | Rule                                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| Resource identity  | Opaque authority-issued UUID, unique within one tenant                          |
| Canonical name     | Unique within one tenant                                                        |
| Definition         | Canonical name, unit, and accounting behavior                                   |
| Definition digest  | Canonical digest of the immutable definition                                    |
| Definition command | First committed command that introduced the Resource definition                 |
| Defining principal | Principal that executed the first committed definition or combined root command |

Existing Resource rows use their original Resource identity as the definition command. A Resource introduced by combined root creation uses the root command as its definition command. Several new Resource rows may therefore share one definition command.

## Resource binding

A Resource binding is an immutable SDK value derived from a committed root result and the submitted schema keys.

| Index             | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| Application key   | Validate and translate public request and settlement input      |
| Resource identity | Project authority results, errors, Policy evidence, and history |

Root creation verifies canonical names and definitions before it creates the binding. The binding contains only allocated root Resources. Child handles use the same binding with a narrower public name type.

## Root-creation command

The command combines one command identity, a non-empty ordered set of Root Resource inputs, and optional canonical Policies.

The canonical body includes every selected definition, amount, and Policy. Exact replay requires the same canonical body. A different definition, amount, selected set, or Policy set under the same command identity is a command conflict.

## State transitions

Root creation has one authority transaction:

1. Validate and canonicalize the complete command.
2. Establish tenant and principal identity and require `create_root_budget`.
3. Bind, replay, or reject the command identity.
4. Reuse exact Resource definitions, reject conflicts, and require `define_resource_type` before inserting any missing definition.
5. Validate Policies against the resolved allocated Resource names.
6. Insert the first Budget in the lineage, holdings, history stream, creation entry, and result.
7. Validate and store the result, then commit.

Any error before commit removes every state change from the command. Exact replay returns the stored result without repeating steps 4 through 7.

## Preserved Budget model

The first Budget in each independently created lineage has no parent, identifies itself as its root, starts active at depth zero, and introduces quantity only through its initial holdings. Keynes enforces no tenant-wide or application-wide aggregate allowance across lineages. Child lineage, Policy evaluation, settlement, subtree accounting, unresolved usage, deficit handling, inspection, and canonical history keep their existing state transitions.
