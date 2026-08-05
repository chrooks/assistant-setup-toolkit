# Machine Context — <machine-name>

<!--
Copy this file to canonical/machines/<machine>/rules.md on the machine it
describes and fill it in. Machine files are local-only and gitignored
(ADR-0003) — they describe a real box and the repo is public. The Setup
Wizard installs the file matching the `machine` Variant as rules/machine.md.
-->

This session runs on **<machine-name>**, <one line: whose machine, what kind,
how sessions arrive>. If you can read this, these facts apply to the current
session.

## Operational constraints

<!-- Network/proxy posture, secrets handling, service discipline, URL rules —
     the hard rules an agent must know before touching infra here. -->

## Resource access

<!-- The local half of the Resource Index (rules/common/resource-index.md,
     ADR-0004): one line per canonical entry — which access mode is live here
     and at what path. Omit entries this machine can't reach. -->

- **The brain:** <e.g. the brain MCP connector only · or local vault at ~/vaults/brain-v2>
- **The toolkit:** <local clone path>

### Machine-local resources

<!-- Resources only this machine knows about (same fixed entry shape as the
     canonical index: what, for, access). Delete the section if none. -->
