import type { RemoteContractTestHost } from "@keynes/database/contract-tests";
import {
  createRemoteKeynesClient,
  type RemoteCommandExecutor,
} from "../../src/generated/client.js";

export async function openRemoteContractTestHost(
  executor: RemoteCommandExecutor,
  closeExecutor: () => Promise<void> = async () => undefined,
): Promise<RemoteContractTestHost> {
  const client = createRemoteKeynesClient(executor);
  return {
    clientFor: () => client,
    close: closeExecutor,
  };
}
