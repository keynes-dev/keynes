export interface QueryRows<Row> {
  readonly rows: readonly Row[];
}

export interface DatabaseConnection {
  query<Row>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<QueryRows<Row>>;
  exec(statement: string): Promise<unknown>;
}

export interface TransactionalDatabase extends DatabaseConnection {
  transaction<Result>(
    operation: (transaction: DatabaseConnection) => Promise<Result>,
  ): Promise<Result>;
}
