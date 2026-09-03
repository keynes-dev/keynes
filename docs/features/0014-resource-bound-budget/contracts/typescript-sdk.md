# TypeScript SDK contract

## Connection

```ts
export interface Keynes extends AsyncDisposable {
  readonly createBudget: RootBudgetCreator;
  readonly close: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}

export type LocalKeynes = Keynes;

export function createKeynes(): Promise<LocalKeynes>;
```

FEAT-0014 implements only the zero-argument local form. Passing any argument, including explicit `undefined`, fails with `invalid_configuration`. FEAT-0013 later adds the accepted `databaseUrl` overload and `RemoteKeynes` capabilities without changing `RootBudgetCreator`.

## Typed root creation

```ts
type ResourceNames<Definitions extends ResourceDefinitions> = Extract<
  keyof Definitions,
  string
>;

interface RootBudgetCreator {
  <
    const Definitions extends ResourceDefinitions,
    const Allocation extends ResourceAmounts<ResourceNames<Definitions>>,
    const Policies extends PolicySetInput | undefined = undefined,
  >(
    schema: ResourceSchema<Definitions>,
    allocation: ExactResourceAmounts<ResourceNames<Definitions>, Allocation>,
    ...options: AttachPolicyArguments<
      Extract<keyof Allocation, ResourceNames<Definitions>>,
      Policies
    >
  ): Promise<
    Budget<
      Extract<keyof Allocation, ResourceNames<Definitions>>,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >
  >;
}
```

The first argument is a value returned by `defineResources`. The second argument must contain at least one key from that schema and no other key. The returned Budget exposes only the allocated key set. Optional Policies may refer only to that set and keep their current context and denial-reason inference.

Only allocated schema entries enter the authority command. The SDK validates the schema digest, allocation, Policy compatibility, and exact result binding. It updates no name-to-identity map before the authority returns a valid committed result.

## Budget handles

Each root handle closes over one immutable Resource binding. Approved child handles reuse that binding and narrow their public Resource-name type to the requested set. Request, settlement, inspection, Policy evidence, history, errors, close, and disposal preserve their current public meaning.

Neither `Keynes` nor `LocalKeynes` exposes Resource registration, a database handle, a transaction handle, or mutable binding state.
