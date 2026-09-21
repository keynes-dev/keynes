# Research: KEY-89

- Decision: use stock 1.0.4 and the existing connector. The installed CLI is 1.0.4;
  the starting repository recorded 0.8.8. Upstream specify supports an explicit
  directory and upstream setup-plan preserves an existing plan. A read-only
  upstream resolver successfully located KEY-74 artifacts before migration.
- Decision: remove the local Git extension and customized workflow. Ordinary Git
  preparation and the standard interactive commands cover the required steps.
- Decision: keep no Linear extension. Linear Integration mirrors phases and tracker
  state; Weave mirrors tasks and defaults to completion before merge. Weave's
  inspected manifest declares >=0.13.0,<1.0.0. Neither matches the accepted model.
- Decision: defer Lean and custom presets. Keep the default lifecycle first;
  future repeated needs can use supported composition without editing managed files.

Sources: [1.0.4 specify](https://github.com/github/spec-kit/blob/v1.0.4/templates/commands/specify.md),
[upgrade guide](https://github.github.io/spec-kit/upgrade.html),
[Weave manifest](https://github.com/tonydwoodhouse/spec-kit-linear-weave/blob/main/extension.yml),
[Linear Integration](https://github.com/ashbrener/spec-kit-linear-sync),
[presets](https://github.github.io/spec-kit/reference/presets.html).
