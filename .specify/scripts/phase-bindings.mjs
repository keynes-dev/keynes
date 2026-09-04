export class PhaseStackError extends Error {}

function fail(message) {
  throw new PhaseStackError(message);
}

export function publicationMarker(parentIdentifier, phaseNumber) {
  return `${parentIdentifier}/Phase-${phaseNumber}`;
}

export function parsePhases(contents) {
  const headings = [...contents.matchAll(/^## Phase ([1-9][0-9]*): (.+)$/gm)];
  const phases = headings.map((heading, index) => {
    const number = Number(heading[1]);
    const body = contents.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? contents.length,
    );
    const issue = /^\*\*Linear issue\*\*: (.+)$/m.exec(body)?.[1];
    const branch = /^\*\*Git branch\*\*: `([^`]+)`$/m.exec(body)?.[1];
    const uuid =
      /^<!-- linear-issue-id: ([0-9a-f-]+) -->$/m.exec(body)?.[1] ?? null;
    const checkpoint = /^\*\*Checkpoint\*\*: (.+)$/m.exec(body)?.[1] ?? null;
    if (!issue && !branch && !uuid) {
      return {
        number,
        title: heading[2],
        state: "legacy",
        issue: null,
        branch: null,
        uuid,
        checkpoint,
      };
    }
    if (issue === "`Unpublished`" && branch === "Unpublished") {
      return {
        number,
        title: heading[2],
        state: "unpublished",
        issue: null,
        branch: null,
        uuid,
        checkpoint,
      };
    }
    const link =
      /^\[([A-Z][A-Z0-9]*-[1-9][0-9]*)\]\((https:\/\/linear\.app\/[^)]+)\)$/.exec(
        issue ?? "",
      );
    if (!link || !branch || !uuid)
      fail(`Phase ${number} has an incomplete Linear binding`);
    return {
      number,
      title: heading[2],
      state: "published",
      issue: { identifier: link[1], url: link[2] },
      branch,
      uuid,
      checkpoint,
    };
  });
  for (let index = 0; index < phases.length; index += 1) {
    if (phases[index].number !== index + 1)
      fail("Phase numbers must be contiguous and start at 1");
  }
  return phases;
}

export function validatePhases(identity, phases, { allowLegacy = false } = {}) {
  if (phases.length === 0) fail("tasks.md contains no phases");
  if (phases.every((phase) => phase.state === "legacy")) {
    if (allowLegacy) return phases;
    fail("tasks.md has no phase issue bindings");
  }
  if (phases.some((phase) => phase.state === "legacy"))
    fail("Every phase must declare a binding");
  const issues = new Set();
  const uuids = new Set();
  const branches = new Set();
  for (const phase of phases) {
    if (!phase.checkpoint) fail(`Phase ${phase.number} has no checkpoint`);
    if (phase.state !== "published") continue;
    if (
      phase.issue.identifier === identity.feature_id ||
      phase.issue.url === identity.work_item.issue_url ||
      phase.uuid === identity.work_item.issue_id ||
      phase.branch === identity.branch
    )
      fail(
        `Phase ${phase.number} must use a sub-issue and branch, not the parent container`,
      );
    if (issues.has(phase.issue.identifier))
      fail(`Duplicate phase issue ${phase.issue.identifier}`);
    if (uuids.has(phase.uuid)) fail(`Duplicate phase issue UUID ${phase.uuid}`);
    if (branches.has(phase.branch))
      fail(`Duplicate phase branch ${phase.branch}`);
    issues.add(phase.issue.identifier);
    uuids.add(phase.uuid);
    branches.add(phase.branch);
  }
  return phases;
}
