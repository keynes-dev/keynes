export type JsonObject = { readonly [key: string]: unknown };

export interface ContractOperation {
  readonly method: string;
  readonly target: string;
  readonly permissions: readonly [string, ...string[]];
  readonly replay: boolean;
  readonly input: string;
  readonly output: string;
}

export type RemoteProcedureMode = "mutation" | "read";

export interface RemoteContractProcedure {
  readonly method: string;
  readonly target: string;
  readonly revision: number;
  readonly mode: RemoteProcedureMode;
  readonly input: string;
  readonly output: string;
}

export interface RemoteContractMetadata {
  readonly semanticGeneration: number;
  readonly minimumSdkGeneration: number;
  readonly semanticIdentities: readonly [string, ...string[]];
  readonly procedures: readonly [
    RemoteContractProcedure,
    ...RemoteContractProcedure[],
  ];
}

export interface ContractSource {
  readonly schema: string;
  readonly operations: readonly ContractOperation[];
  readonly remote: RemoteContractMetadata;
}

export interface LoadedContract {
  readonly source: ContractSource;
  readonly schema: JsonObject;
  readonly definitions: JsonObject;
  readonly digest: string;
  readonly remoteDigest: string;
}
