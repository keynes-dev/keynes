from pathlib import Path
import hashlib, json, os, subprocess, tempfile

source = Path.cwd()
(source/'.artifacts/speckit-proof').mkdir(parents=True, exist_ok=True)
proof = Path(tempfile.mkdtemp(prefix='keynes-speckit-89-'))
repo = proof / 'repo'
repo.mkdir()
records = []

def run(args, cwd=repo, expected=0, env=None):
    result = subprocess.run(args, cwd=cwd, env=env, text=True, capture_output=True)
    records.append({'command': args, 'cwd': str(cwd), 'exit': result.returncode,
                    'stdout': result.stdout, 'stderr': result.stderr})
    assert result.returncode == expected, records[-1]
    return result.stdout

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def authored(root):
    return {str(p.relative_to(root)): digest(p) for base in ['docs/features', 'docs/adr']
            for p in (root/base).rglob('*') if p.is_file()}

def managed(root):
    names = set()
    for p in (root/'.specify/integrations').glob('*.manifest.json'):
        names.update(json.loads(p.read_text())['files'])
    return {name: digest(root/name) for name in sorted(names)}

def status(root):
    s = json.loads(run(['specify','integration','status','--json'], cwd=root))
    assert s['status'] == 'ok' and not s['findings'], s
    return s

run(['git', 'checkout-index', '--all', '--prefix='+str(repo)+'/'], cwd=source)
assert not (repo/'.specify/feature.json').exists()
status(repo)
assert len(list((repo/'.agents/skills').glob('speckit-*/SKILL.md'))) == 10
assert not (repo/'.specify/scripts/feature-identity.mjs').exists()
assert not (repo/'.specify/extensions/git').exists()
assert not (repo/'.specify/workflows/speckit/workflow.yml').exists()
assert json.loads((repo/'.specify/extensions/.registry').read_text())['extensions'] == {}
assert 'hooks: {}' in (repo/'.specify/extensions.yml').read_text()
assert 'Constitution Authority' in (repo/'.agents/skills/speckit-analyze/SKILL.md').read_text()
for p in (repo/'.agents/skills').glob('speckit-*/SKILL.md'):
    assert 'feature-identity.mjs' not in p.read_text()

before = authored(repo)
managed_before = managed(repo)
for _ in range(2):
    run(['specify','integration','upgrade','codex','--script','sh'])
    status(repo)
    assert authored(repo) == before
    assert managed(repo) == managed_before

# Compare to an independent stock install, not just locally stored hashes.
pristine = proof/'pristine'
run(['specify','init',str(pristine),'--integration','codex','--script','sh',
     '--non-interactive','--ignore-agent-tools'])
assert managed(pristine) == managed_before

run(['git','init','-q'])
run(['git','add','.'])
run(['git','-c','user.name=Spec Kit verification','-c','user.email=verification@example.invalid',
     'commit','-qm','Disposable fixture base'])
a = proof/'feature-a'; b = proof/'feature-b'
run(['git','worktree','add','-b','fixture/key-89-small-feature',str(a)])
run(['git','worktree','add','-b','fixture/key-89-resume',str(b)])
missing = run(['bash','.specify/scripts/bash/check-prerequisites.sh','--json','--paths-only'],cwd=a,expected=1)
assert not (a/'.specify/feature.json').exists()

old_feature = 'docs/features/key-74-deliver-each-spec-kit-feature-through-one-issue-and-pr'
env = dict(os.environ, SPECIFY_FEATURE_DIRECTORY=old_feature)
original = authored(b)
run(['bash','.specify/scripts/bash/check-prerequisites.sh','--json','--paths-only'],cwd=b,env=env)
assert not (b/'.specify/feature.json').exists()
run(['bash','.specify/scripts/bash/setup-plan.sh','--json'],cwd=b,env=env)
assert authored(b) == original
assert json.loads((b/'.specify/feature.json').read_text()) == {'feature_directory':old_feature}
b_pointer = digest(b/'.specify/feature.json')

# Prepare the explicit feature path for the agent-followed lifecycle demonstration.
fixture = 'docs/features/key-89-small-feature'
(a/fixture).mkdir(parents=True)
(a/'.specify/feature.json').write_text(json.dumps({'feature_directory':fixture})+'\n')
assert digest(b/'.specify/feature.json') == b_pointer
for root in [a,b]:
    run(['git','check-ignore','.specify/feature.json'],cwd=root)
    assert not run(['git','ls-files','.specify/feature.json'],cwd=root).strip()

base_files = run(['git','ls-tree','-r','--name-only','8a432f0','docs/features','docs/adr'],cwd=source).splitlines()
for name in base_files:
    expected = subprocess.run(['git','show','8a432f0:'+name],cwd=source,capture_output=True,check=True).stdout
    assert (source/name).read_bytes() == expected, name
base_constitution=run(['git','show','8a432f0:.specify/memory/constitution.md'],cwd=source)
current=(source/'.specify/memory/constitution.md').read_text()
assert base_constitution.split('## Core principles',1)[1].split('## Delivery and evidence gates',1)[0] == current.split('## Core principles',1)[1].split('## Delivery and evidence gates',1)[0]

result={'proof_root':str(proof),'fixture_worktree':str(a),'fixture_directory':fixture,
        'staged_tree':run(['git','write-tree'],cwd=source).strip(),
        'historical_files_preserved':len(base_files),'managed_files':len(managed_before),
        'checks':['fresh checkout: all 10 core skills and no tracked pointer',
                  'no installed extension or custom workflow',
                  'analysis retains constitution authority',
                  'two non-forced same-version upgrades preserve authored and managed bytes',
                  'managed bytes equal independent pristine 1.0.4 install',
                  'missing selection fails without creating pointer',
                  'read-only resolution does not write pointer',
                  'existing KEY-74 plan and authored files survive setup',
                  'separate worktree pointers are independent and ignored',
                  'historical features and ADRs preserve exact bytes',
                  'core constitution principles and product constraints preserve exact text'],
        'commands':records}
(source/'.artifacts/speckit-proof/results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='commands'},indent=2))
