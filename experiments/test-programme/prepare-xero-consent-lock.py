"""Reproduce the consent-only lock from the committed root lock; no resolution/network.
Development utility needs the existing PyYAML installation. Hosting/build uses Node only.
Review/commit the generated diff; this script never installs or enables anything.
"""
import hashlib
import json
import re
from pathlib import Path
import yaml

source = Path(__file__).resolve().parent
root_path = source.parent.parent / 'pnpm-lock.yaml'
root = yaml.safe_load(root_path.read_text())
manifest = json.loads((source / 'operator-package.manifest.json').read_text())
queue = [f'{name}@{version}' for name, version in manifest['dependencies'].items()]
seen = set()
while queue:
    key = queue.pop()
    if key in seen:
        continue
    if key not in root['snapshots']:
        raise ValueError(f'Missing root-lock snapshot: {key}')
    seen.add(key)
    for kind in ('dependencies', 'optionalDependencies'):
        for name, version in root['snapshots'][key].get(kind, {}).items():
            if version.startswith(('link:', 'workspace:', 'file:')):
                raise ValueError('Local dependency outside isolated package')
            queue.append(name + '@' + version)
packages = {re.sub(r'\(.*$', '', key): root['packages'][re.sub(r'\(.*$', '', key)] for key in sorted(seen)}
if any(not p.get('resolution', {}).get('integrity', '').startswith('sha512-') for p in packages.values()):
    raise ValueError('Every isolated package must have root-lock integrity metadata')
lock = {'lockfileVersion': '9.0', 'settings': {'autoInstallPeers': False, 'excludeLinksFromLockfile': False}, 'importers': {'.': {'dependencies': {name: {'specifier': version, 'version': version} for name, version in manifest['dependencies'].items()}}}, 'packages': packages, 'snapshots': {key: root['snapshots'][key] for key in sorted(seen)}}
output = source / 'xero-consent-operator-pnpm-lock.yaml'
output.write_text(yaml.safe_dump(lock, sort_keys=False, width=100000))
metadata = {'source': 'pnpm-lock.yaml', 'sourceSha256': hashlib.sha256(root_path.read_bytes()).hexdigest(), 'lockSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'dependencies': manifest['dependencies'], 'packageCount': len(packages), 'snapshotCount': len(seen), 'purpose': 'Existing root-lock dependency closure only; no network resolution or install'}
(source / 'xero-consent-lock-provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps({'state': 'consent_lock_prepared', 'packages': len(packages), 'snapshots': len(seen)}))
