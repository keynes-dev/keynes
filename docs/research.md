# Research agenda: Runtime economics for agent organizations

> **Status:** Proposed research program. None of the studies, datasets, results,
> field claims, or publications in this document exist yet. The
> [product](product.md) defines what Keynes intends to become. The
> [architecture](architecture.md) defines the runtime boundary and release
> gates.

## Strategic thesis

Businesses will manage agents as a portfolio of delegated work. Those workflows
compete for money, time, tool capacity, human attention, risk capacity, and
decision rights. A business needs to know where the next unit of each Resource
creates value. It also needs to know what happens when a workflow does not
receive the authority that it requested.

Most agent evaluations treat resource use as a token count or a dollar total.
That view misses the operating decisions that determine whether agent work is
worth doing. A workflow can be cheap and still waste a scarce reviewer. A
stronger model can cost more per call but reduce retries, elapsed time, and
rework. Ten more searches can have no value without permission to use a
specialized dataset. Some Resource combinations degrade smoothly when
constrained. Others have a hard minimum below which the workflow cannot make a
responsible promise.

Keynes creates an experimental subject for these questions. An application
defines Resources in its own vocabulary, delegates exact quantities through
Budgets, and settles observed use. Keynes records authority and accounting. The
application continues to own workflow strategies, external effects, fallback
behavior, human decisions, and business outcomes.

The research program asks how organizations should allocate scarce Resources
across agent workflows. It does not make Keynes an optimizer or a study-design
product. An application-owned research system can join Keynes evidence with
workflow outcomes and calculate the analyses described here.

## Research foundations

The program extends several established fields.

- [Constrained Policy Optimization](https://proceedings.mlr.press/v70/achiam17a.html)
  separates an objective from the constraints that a decision policy must
  satisfy. Keynes can test this distinction in delegated business workflows
  with enforced Resource limits.
- [Bandits with Knapsacks](https://arxiv.org/abs/1305.2545) models reward
  alongside several limited Resources. Keynes adds hierarchy, exact
  reservation, delayed settlement, reusable Resources, and workflow
  dependencies.
- [Anytime algorithms](https://cdn.aaai.org/AAAI/1988/AAAI88-009.pdf) return the
  best answer available within the computation time received. Keynes can extend
  that idea to rejection of any Resource and to explicit changes in the
  workflow's promise.
- [Learning to defer](https://proceedings.iclr.cc/paper_files/paper/2025/hash/78df0f831fbe5854349dbdfccde7ee5d-Abstract-Conference.html)
  studies when a model should pass a decision to a human. Keynes can study how
  a business allocates a limited pool of expert time across complete workflows.
- [Portfolio selection](https://www.jstor.org/stable/2975974) studies expected
  return, variance, and diversification across investments. Keynes can test
  whether portfolios of agent workflows have useful risk and return structure.
- [Formal and Real Authority in Organizations](https://doi.org/10.1086/262063)
  explains how formal decision rights differ from effective control. Keynes can
  make formal Resource authority observable while experiments measure who
  controls the work in practice.
- [Hierarchies and the Organization of Knowledge in Production](https://doi.org/10.1086/317671)
  explains why organizations route exceptional problems to scarce experts.
  Agent delegation and human escalation create a new setting for that question.

These foundations do not establish the Keynes claims. They identify accepted
constructs that Keynes can extend with new experiments.

## Multi-Resource production functions

### Proposed paper

**Beyond Tokens: Estimating Multi-Resource Production Functions for Agent
Workflows**

### Question

How do money, model capability, searches, tool access, elapsed time, retries,
and human attention combine to produce a business outcome?

### Study design

Hold the workflow objective and evaluation corpus constant. Define several
complete ways to perform the work. A research workflow might support autonomous
screening, deep investigation, analyst-assisted investigation, and diagnosis
followed by handoff. Each strategy declares the Resources that it needs before
execution.

Randomize the available Resource quantities across repeated tasks. Include
conditions that vary one Resource and conditions that vary coupled Resources.
The experiment must distinguish the requested quantity, the reserved quantity,
the settled use, and the external outcome.

Measure at least these outcome families:

- task quality and realized business value;
- cycle time and deadline compliance;
- human review, correction, and rework;
- provider and tool consumption;
- defects, reversals, and downstream harm;
- outcome variance and downside loss.

Estimate the marginal outcome gain from each added Resource. Test whether two
Resources are substitutes or complements. Identify saturation, minimum viable
Resource bundles, and the estimated value of relaxing each binding constraint.
That last value is the constraint's shadow price. It is not necessarily the
purchase price of the Resource.

### Strategic contribution

The study would replace "cost per run" with a production model that a business
can use for allocation. It could also explain why a cheaper model or smaller
tool allowance sometimes raises total operating cost after retries, rework, and
human escalation.

Published productivity studies provide useful outcome measures but usually
compare access to AI with no access. A field study of 5,172 support agents found
a 15 percent average increase in issues resolved per hour, with substantial
differences across workers
([Brynjolfsson, Li, and Raymond](https://academic.oup.com/qje/article/140/2/889/7990658)).
A controlled study of 453 professionals found that ChatGPT reduced completion
time by 40 percent and increased assessed quality by 18 percent
([Noy and Zhang](https://doi.org/10.1126/science.adh2586)). The proposed Keynes
study asks which Resource combinations produce those gains and where the next
unit has the highest value.

## Graceful degradation after Resource rejection

### Proposed paper

**Denied, Then What? Graceful Degradation in Resource-Constrained Agent
Workflows**

### Question

How much valid business value can a workflow retain after one of its requested
Resources is denied?

### Study design

The operator defines safe strategies before the experiment. A strategy can
narrow the scope, substitute a method, return diagnosis without execution,
defer work, request human help, abstain, or stop. Keynes does not invent or rank
these strategies.

Randomly deny Resources at different points in a delegation tree. Vary the
denied Resource, the size of the shortfall, and the time at which the denial
occurs. Compare workflows that receive a structured denial with workflows that
only receive a generic failure or discover exhaustion during execution.

Measure:

- outcome value retained relative to full authority;
- invalid improvisation and constraint violations;
- extra Resources consumed during recovery;
- time to a valid fallback, handoff, or safe stop;
- uncertainty calibration after the workflow reduces its promise;
- the accuracy of the service level communicated to the user.

The result is a degradation curve for each workflow and Resource. A smooth
curve means that the workflow can preserve useful outcomes under tighter
limits. A cliff identifies an indivisible Resource requirement.

### Strategic contribution

This study defines agent resilience in business terms. A resilient workflow
does not merely continue. It preserves the best valid outcome and states what
it can no longer promise. The findings could help a business decide which
workflows may use flexible Budgets and which require full funding before work
starts.

## Human attention as a Resource

### Proposed paper

**Who Gets the Human? Allocating Expert Attention Across Agent Workflows**

### Question

How should a business allocate a limited pool of expert minutes across a queue
of agent workflows?

### Study design

Treat expert time as a Resource with a capacity, an availability window, and an
expertise requirement. Do not collapse it into money. Five minutes from one
person may not substitute for five minutes from another. Queue delay, fatigue,
and opportunity cost also matter.

Compare allocation rules based on arrival order, agent uncertainty, expected
financial value, expected value of human intervention, and risk class. Include
a rule that reserves capacity for rare high-impact cases.

Measure:

- business value and avoided loss per expert minute;
- queue delay and deadline failure;
- error detection and correction;
- expert utilization and workload concentration;
- downstream rework;
- changes in agent and worker performance over time.

Research on human and machine integration shows that each decision layer can
correct an error or introduce one. The placement of final authority therefore
matters
([Zhong, Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.2024.07401)).
The Keynes study extends that problem from one decision to a portfolio of
competing workflows.

### Strategic contribution

Human attention is likely to remain the binding Resource in many valuable agent
workflows. This study would give operations leaders a way to compare escalation
rules without assuming that more human review is always better.

## Efficient frontiers for agent operations

### Proposed paper

**Efficient Frontiers for Agent Operations: Allocating Resources Across a
Portfolio of Workflows**

### Question

How should a business allocate scarce Resources across workflows with uncertain
and correlated outcomes?

### Study design

Estimate a joint outcome distribution for each repeated workflow strategy.
Record its expected business value, Resource requirements, outcome variance,
downside loss, time to outcome, and exposure to shared dependencies. Shared
dependencies include models, providers, datasets, tools, and human teams.

Compare allocation policies based on equal allocation, historical return,
departmental quotas, mean-variance optimization, downside-risk optimization,
and online allocation with learned shadow prices. Include provider outages,
model changes, demand spikes, and correlated evaluation failures as shared
shocks.

Use Conditional Value at Risk to represent severe downside outcomes. Accepted
work has developed CVaR methods for risk-sensitive reinforcement learning
([Wang, Kallus, and Sun](https://proceedings.mlr.press/v202/wang23m)). The
business study should also report the uncompressed outcome distribution because
a single risk score can hide the type of harm.

### Limits of the portfolio analogy

Agent workflows are not financial securities. Their outcomes are nonstationary,
often non-normal, and affected by operational intervention. Model upgrades can
change the distribution without warning. Some Resources are reusable capacity,
while others are consumed. Business outcomes can also be categorical or
delayed.

The study should therefore use portfolio theory as a starting point. It should
test robust allocation and multiple Resource constraints rather than apply a
Markowitz model without modification.

One useful result would be an agent concentration measure. The measure would
quantify how much apparent diversification disappears after accounting for
shared models, providers, data, and human teams.

### Strategic contribution

The study moves agent management from isolated run economics to firm-level
capital allocation. It could give a chief financial officer or an operations
leader a defensible way to compare investments in different agent workflows.

## Formal and real authority in agent organizations

### Proposed paper

**Formal and Real Authority in Agentic Organizations**

### Question

When does an agent's effective control differ from the formal authority that a
business grants through Budgets and Policies?

### Study design

Vary formal Resource authority, information access, approval delay, principal
workload, Policy strictness, urgency, and the depth of delegation. Keep the task
and available capabilities constant where the experiment requires a direct
comparison.

Measure initiative, task completion, control loss, unnecessary escalation,
decision latency, policy violations, and principal workload. Test whether slow
approval or overloaded supervisors produce de facto autonomy even when the
formal rules appear strict.

The work should distinguish formal authority from capability. A tool can be
technically available while a Budget denies authority to use it. The opposite
problem also matters. Formal permission can have little practical value when
the agent lacks the information needed to decide well.

### Strategic contribution

This work connects Keynes to organizational design. It asks how firms should
structure delegation when some workers are software agents with explicit,
machine-enforced authority. An organizational economist would make a strong
research partner for the theoretical model and experimental design.

## Staged authority as a real option

### Proposed paper

**Start Small, Expand on Evidence: The Option Value of Staged Agent Budgets**

### Question

Does staged Resource authority create more business value than either full
funding or one conservative cap?

### Study design

Compare full funding before work starts, one fixed cap, a small exploratory
Budget followed by expansion, milestone-based allocation, and continuous
reallocation across competing workflows.

Measure avoided downside, premature abandonment, Resources tied up in weak
work, evidence gained before expansion, and value recovered by reallocating
unused capacity. The study must account for the cost of waiting and the risk
that another workflow consumes a Resource before the next stage begins.

### Strategic contribution

A staged Budget becomes a commitment mechanism. The business spends a limited
amount to learn whether a larger commitment is justified. This study could
connect agent operations to real-options analysis and staged corporate
investment.

## Supporting systems reports

The strategic papers depend on trustworthy runtime evidence. Keynes can publish
three narrower technical reports as the implementation reaches the required
gates.

### Authority under failure

**Authority Under Failure: Executable Resource Conservation for Agent
Workflows** would specify the Budget invariants and test concurrent sibling
requests, lost responses, exact replay, nested settlement, missing usage,
overage, and failures before commit. The report would release the scenario
corpus, expected projections, execution traces, and fault-injection tools.

### One authority across PostgreSQL runtimes

**One Authority, Two PostgreSQL Runtimes** would compare canonical behavior in
PGlite and native PostgreSQL. It would report semantic agreement, installation
cost, package size, loaded memory, startup latency, steady-state latency, and
the native concurrency behavior that PGlite cannot qualify.

### SQL Policies for Resource governance

**SQL Policies for Agent Resource Governance** would measure the expressiveness,
runtime cost, predictability, and escape resistance of the constrained Policy
language. The adversarial corpus would cover forbidden relation access, unsafe
functions, recursion, excessive work, dependency drift, malformed results, and
concurrent activation.

These reports can establish system credibility. They do not substitute for the
business-outcome studies.

## Research method

Each study must make its evidence easy to inspect and reproduce.

- Predeclare the hypotheses, outcomes, exclusions, stopping rule, and analysis
  before collecting the evidence used for the main claim.
- Hold back tasks or time periods that do not influence strategy selection or
  model tuning.
- Record the exact model, provider, prompt, tool, dataset, contract digest,
  runtime artifact, and price schedule used for each result.
- Separate Resource requests, reservations, settled use, and business outcomes.
- Report the complete outcome set. Do not hide quality loss behind a lower
  dollar total or hide human burden inside an aggregate cost.
- Retain failed, denied, unresolved, and abandoned runs. Success-only data
  cannot support a Resource allocation claim.
- Publish code, synthetic fixtures, analysis notebooks, and data when customer
  privacy and licenses allow it. Publish a detailed schema and generation
  method when raw data cannot be released.
- Seek external coauthors for economics, operations research, statistics, and
  human-subject work. Use independent review before making a broad business
  claim.
- Separate controlled benchmark evidence from field evidence. A simulation can
  establish a mechanism. It cannot establish realized customer value.
- Report negative and null results. A Resource that does not improve an outcome
  is still useful allocation evidence.

## Publication sequence

The pre-launch program should remain small enough to finish.

1. Publish **Beyond Tokens** to establish the Resource vocabulary and the
   multi-Resource production method.
2. Publish **Denied, Then What?** to define graceful degradation and produce a
   memorable empirical result tied to Resource rejection.
3. Develop **Formal and Real Authority** with an organizational-economics
   collaborator. A preregistered design or theoretical paper can precede the
   field study.
4. During private preview, run a Frontier Study with design partners. Join
   Keynes evidence to partner-owned outcomes without moving outcome meaning
   into the Keynes runtime.
5. Use repeated field data to publish **Who Gets the Human?** and **Efficient
   Frontiers for Agent Operations**.
6. Study staged authority after repeated workflows provide reliable signals for
   expansion and abandonment decisions.

The systems reports follow their implementation gates. No report should claim
PGlite, native PostgreSQL, Policy security, concurrency, performance, field
value, or production readiness before that evidence runs.

## Business strategy

The research program can create a category around agent operations economics.
It can also create a design-partner offer before Keynes has enough repeated data
for broad product claims.

A Frontier Study would take one repeated customer workflow and produce:

- a measured multi-Resource production function;
- the binding constraints and estimated shadow prices;
- a graceful-degradation policy owned by the customer;
- an allocation analysis for human attention;
- a risk-adjusted operating frontier;
- promotion, rollback, and resweep criteria.

The study would give a head of AI, an operations leader, or a financial owner a
decision about the workflow. The customer would learn whether to expand,
constrain, redesign, or stop the work. Keynes would gain an evidence corpus that
tests whether its Resource and Budget model describes real operating decisions.

The strongest strategic claim is narrow:

> Keynes makes agent operations measurable and governable enough for a business
> to apply economics, experimentation, and portfolio management.

That claim still requires evidence. This agenda defines how to collect it.
