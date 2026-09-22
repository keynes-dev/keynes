# Policy Request Contract

## Public Budget surface

Local, Embedded and Remote Budget handles expose:

```ts
budget.request(resources);
budget.request(resources, { policy });
```

They do not expose `prepareRequest` or a replacement standalone Policy operation.

## Integrated Policy request

For an admitted call with valid options and proposal input, the SDK invokes the supplied Policy once. It validates the terminal result and any transformed Resource envelope through the existing shared validation path. Only `prepared` submits one ordinary allocation command. `rejected`, `review_required` and `failed` return without submission. Synchronous throws and rejected Promises retain the existing integrated-request normalization.

A Remote caller-supplied operation key cannot be combined with Policy. The SDK rejects that combination before Policy invocation.

## Direct application execution

An application that needs to retain a decision calls its Policy as ordinary application code. Throws and rejected Promises propagate normally because the SDK is not invoking that Policy. The application owns durable storage, worker fencing, provider idempotency, retry choices and recomputation. It may later submit final resources through the Policy-free request path with a Remote operation key.

Keynes adds no checkpoint, resume operation, request builder, persistence adapter or Policy runner.
