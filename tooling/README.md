# Repository tooling

`tooling/` owns contributor automation that is not product runtime code.

`tooling/contracts/` generates the declared contract consumers. `tooling/repository/` validates the active Spec Kit feature identity and repository organization. Run these tools only through the root commands in `package.json`.

Product workspaces do not import `tooling/`. The directory is not a workspace, package, or supported runtime interface.
