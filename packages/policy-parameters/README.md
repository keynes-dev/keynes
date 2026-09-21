# Policy parameters

Private source contract. Public tooling distribution belongs to KEY-117.

The optional `@keynes/policy-parameters/zod` adapter supports exactly Zod 4.6.5. Core declarations and portable snapshots do not require Zod.

Supported authoring: unchecked strings, booleans, null, JSON literals/enums, finite numbers with bounds, safe integers, homogeneous arrays with length bounds, strict objects, ordinary unions, nullable wrappers and optional wrappers on object properties. An optional branch inside a union is rejected; wrap the complete property union in `.optional()` instead. Discriminated unions and XOR unions are not qualified.

The adapter rejects refinements, transforms, coercion, defaults, catches, string checks, numeric multiples, non-JSON types and other unsupported constructs. It ignores global metadata and rejects converter/conditional callbacks. Conversion uses stock draft-07 output and the same strict core validation as raw JSON Schema.
