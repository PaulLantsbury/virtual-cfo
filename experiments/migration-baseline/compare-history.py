# Run from the repository root. Compares this repository SQL subset, not arbitrary SQL.
from pathlib import Path
import json,re,hashlib
root=Path('db-migrations/reconciliation/2026-09-08');cat=json.loads((root/'public-catalog.json').read_text())
def normalise(s):
 tokens=re.findall(r"--[^\n]*|/\*.*?\*/|'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|[A-Za-z_][A-Za-z_0-9]*|[^\s]",s,re.S)
 return ' '.join(t if t.startswith(("'",'"')) else t.lower() for t in tokens if not t.startswith(('--','/*')))
def functions(s):
 pattern=r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(.*?\bAS\s+(\$\w*\$)(.*?)\2'
 return [(m.group(1),m.group(3)) for m in re.finditer(pattern,s,re.S|re.I)]
live={f['name']:functions(f['definition'])[0][1] for f in cat['functions']};report=[]
for p in sorted(list((root/'recovered').glob('*.sql'))+list(Path('db-migrations/migrations').glob('*.sql'))):
 matches=[]
 for name,body in functions(p.read_text()):
  matches.append({'name':name,'body_status':'absent' if name not in live else 'matches_current_body' if normalise(body)==normalise(live[name]) else 'different_or_superseded_body'})
 report.append({'file':str(p),'version':p.name.split('_')[0],'recorded_in_cloud':p.name.split('_')[0] in cat['ledger'],'functions':matches})
(root/'function-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
for r in report:
 if '/migrations/' in r['file'] or not r['recorded_in_cloud']:print(r['file'].split('/')[-1],r['recorded_in_cloud'],r['functions'])
