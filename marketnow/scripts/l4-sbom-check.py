#!/usr/bin/env python3
# L4 — Supply Chain Audit (SBOM + OSV)
import json, os, sys, subprocess, urllib.request, hashlib
from datetime import datetime, timezone

def get_osv_vulns(name, version, ecosystem="npm"):
    try:
        payload = json.dumps({"package":{"name":name,"ecosystem":ecosystem},"version":version}).encode()
        req = urllib.request.Request("https://api.osv.dev/v1/query", data=payload, method='POST')
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()).get('vulns', [])
    except: return []

def generate_sbom(repo_path, skill_id):
    sbom = {'skill_id': skill_id, 'generated_at': datetime.now(timezone.utc).isoformat(),
            'dependencies': [], 'vulnerabilities': [], 'total_vulns': 0, 'critical_vulns': 0}
    pkg = os.path.join(repo_path, 'package.json')
    if os.path.exists(pkg):
        with open(pkg) as f: d = json.load(f)
        deps = {**d.get('dependencies',{}), **d.get('devDependencies',{})}
        for name, ver in deps.items():
            cv = ver.lstrip('^~>=< ')
            sbom['dependencies'].append({'name':name,'version':cv,'ecosystem':'npm'})
            for v in get_osv_vulns(name, cv, 'npm'):
                sbom['vulnerabilities'].append({'package':name,'version':cv,'id':v.get('id','?'),
                    'summary':v.get('summary','?')[:100],'severity':v.get('severity',[{}])[0].get('value','?') if v.get('severity') else '?'})
                sbom['total_vulns'] += 1
                if 'CRITICAL' in str(v.get('severity','')).upper(): sbom['critical_vulns'] += 1
    sbom['total_dependencies'] = len(sbom['dependencies'])
    return sbom

if __name__ == '__main__':
    sbom = generate_sbom(sys.argv[1] if len(sys.argv)>1 else '.', sys.argv[2] if len(sys.argv)>2 else 'test')
    print(json.dumps(sbom, indent=2))
