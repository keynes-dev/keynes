export type JsonObject = { readonly [key: string]: unknown };

export interface ContractOperation {
  readonly method: string;
  readonly target: string;
  readonly permission: string;
  readonly replay: boolean;
  readonly input: string;
  readonly output: string;
}

export interface ContractSource {
  readonly schema: string;
  readonly operations: readonly ContractOperation[];
}

export interface LoadedContract {
  readonly source: ContractSource;
  readonly schema: JsonObject;
  readonly definitions: JsonObject;
  readonly digest: string;
}
