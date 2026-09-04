export class IssueWorkflowError extends Error {}

function fail(message) {
  throw new IssueWorkflowError(message);
}

export function publicationMarker(parent, publicationId) {
  return `<!-- speckit-unit: ${parent}/${publicationId} -->`;
}

export function parseUnits(contents) {
  const headings = [...contents.matchAll(/^## (.+)$/gm)];
  return headings.flatMap((heading, index) => {
    const body = contents.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? contents.length,
    );
    const publicationId =
      /^<!-- publication-id: ([A-Za-z0-9][A-Za-z0-9/-]*) -->$/m.exec(body)?.[1];
    const issue = /^\*\*Linear issue\*\*: (.+)$/m.exec(body)?.[1];
    const branch = /^\*\*Git branch\*\*: `([^`]+)`$/m.exec(body)?.[1];
    const uuid =
      /^<!-- linear-issue-id: ([0-9a-f-]+) -->$/m.exec(body)?.[1] ?? null;
    const checkpoint = /^\*\*Checkpoint\*\*: (.+)$/m.exec(body)?.[1] ?? null;
    if (!publicationId && !issue && !branch && !uuid) return [];
    if (!publicationId) fail(`${heading[1]} has no immutable publication ID`);
    if (!checkpoint) fail(`${heading[1]} has no checkpoint`);
    if (issue === "`Unpublished`" && branch === "Unpublished" && !uuid)
      return [
        {
          title: heading[1],
          publicationId,
          state: "unpublished",
          issue: null,
          branch: null,
          uuid,
          checkpoint,
        },
      ];
    const link =
      /^\[([A-Z][A-Z0-9]*-[1-9][0-9]*)\]\((https:\/\/linear\.app\/[^)]+)\)$/.exec(
        issue ?? "",
      );
    if (
      !link ||
      !branch ||
      branch === "Unpublished" ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(uuid ?? "")
    )
      fail(`${heading[1]} has an incomplete Linear binding`);
    if (!heading[1].startsWith(`${link[1]} `))
      fail(`${heading[1]} must start with ${link[1]}`);
    if (
      !new URL(link[2]).pathname
        .toLowerCase()
        .includes(`/issue/${link[1].toLowerCase()}/`)
    )
      fail(`Issue URL does not match ${link[1]}`);
    return [
      {
        title: heading[1].slice(link[1].length + 1),
        publicationId,
        state: "published",
        issue: { identifier: link[1], url: link[2] },
        branch,
        uuid,
        checkpoint,
      },
    ];
  });
}

export function validateUnits(identity, units) {
  const seen = new Set();
  for (const unit of units) {
    for (const [kind, value] of [
      ["publication ID", unit.publicationId],
      ["issue", unit.issue?.identifier],
      ["UUID", unit.uuid],
      ["branch", unit.branch],
    ]) {
      if (!value) continue;
      const key = `${kind}:${value}`;
      if (seen.has(key)) fail(`Duplicate ${kind} ${value}`);
      seen.add(key);
    }
    if (unit.state !== "published") continue;
    if (
      unit.issue.identifier === identity.feature_id ||
      unit.issue.url === identity.work_item.issue_url ||
      unit.uuid === identity.work_item.issue_id ||
      unit.branch === identity.branch
    )
      fail(
        `${unit.issue.identifier} must use a sub-issue and branch, not the parent container`,
      );
  }
  return units;
}

// The caller supplies a fresh, fully paginated child-issue snapshot from Linear.
// This returns intentions only; the connector owns mutations and read-back.
export function planPublication(identity, units, selected, existing) {
  validateUnits(identity, units);
  if (!selected.length) fail("Select at least one publication ID or issue key");
  const resolved = new Set();
  return selected.map((selector) => {
    const matches = units.filter(
      (unit) =>
        unit.publicationId === selector || unit.issue?.identifier === selector,
    );
    if (matches.length !== 1)
      fail(`Unknown or ambiguous selection ${selector}`);
    const unit = matches[0];
    if (resolved.has(unit.publicationId))
      fail(`Duplicate selection ${selector}`);
    resolved.add(unit.publicationId);
    const marker = publicationMarker(identity.feature_id, unit.publicationId);
    const legacyMarker = `${identity.feature_id}/${unit.publicationId}`;
    const matchesRemote = existing.filter(
      (issue) =>
        issue.uuid === unit.uuid ||
        issue.description?.includes(marker) ||
        (unit.publicationId.startsWith("Phase-") &&
          (issue.description ?? "").split(/[\s`]+/).includes(legacyMarker)),
    );
    if (matchesRemote.length > 1)
      fail(`Duplicate remote publication ${unit.publicationId}`);
    const issue = matchesRemote[0];
    if (unit.state === "published" && (!issue || issue.uuid !== unit.uuid))
      fail(`Published issue missing or mismatched: ${selector}`);
    return {
      publicationId: unit.publicationId,
      action: issue ? "reuse" : "create",
      id: issue?.uuid ?? null,
      title: issue?.title ?? unit.title,
      marker,
    };
  });
}

export function planBlockerChanges(parent, issues, changes) {
  const graph = new Map(
    issues.map((issue) => [issue.id, new Set(issue.blockedBy)]),
  );
  const touched = new Set();
  const operations = changes.map(({ id, add = [], remove = [] }) => {
    if (id === parent || !graph.has(id) || touched.has(id))
      fail(`Invalid or duplicate dependent ${id}`);
    touched.add(id);
    const dependencies = graph.get(id);
    for (const prerequisite of [...add, ...remove]) {
      if (prerequisite === parent || prerequisite === id)
        fail("Parent and self blockers are forbidden");
      if (!graph.has(prerequisite))
        fail(`Missing dependency snapshot ${prerequisite}`);
      if (add.includes(prerequisite) && remove.includes(prerequisite))
        fail(`Conflicting dependency change ${prerequisite}`);
    }
    const additions = [...new Set(add)].filter((key) => !dependencies.has(key));
    const removals = [...new Set(remove)].filter((key) =>
      dependencies.has(key),
    );
    for (const key of removals) dependencies.delete(key);
    for (const key of additions) dependencies.add(key);
    return {
      id,
      ...(additions.length ? { blockedBy: additions } : {}),
      ...(removals.length ? { removeBlockedBy: removals } : {}),
    };
  });
  const visited = new Set();
  const visiting = new Set();
  function visit(key) {
    if (visiting.has(key)) fail(`Dependency cycle at ${key}`);
    if (visited.has(key)) return;
    const dependencies = graph.get(key);
    if (!dependencies) fail(`Missing dependency snapshot ${key}`);
    visiting.add(key);
    for (const dependency of dependencies) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of graph.keys()) visit(key);
  return operations.filter(
    (operation) => operation.blockedBy || operation.removeBlockedBy,
  );
}
