#!/usr/bin/env python3
# L4.5 — Content Fingerprint (SHA-256 of repo HEAD)
import subprocess, sys, hashlib, json
from datetime import datetime, timezone

def get_fingerprint(repo_url):
    subprocess.run(['git','clone','--depth','1',repo_url,'/tmp/l4_fp'], capture_output=True, timeout=60)
    h = subprocess.run(['git','-C','/tmp/l4_fp','rev-parse','HEAD'], capture_output=True, text=True, timeout=10)
    files = subprocess.run(['git','-C','/tmp/l4_fp','ls-files','-s'], capture_output=True, text=True, timeout=30)
    subprocess.run(['rm','-rf','/tmp/l4_fp'], capture_output=True)
    return {'commit_hash':h.stdout.strip(),'tree_sha256':hashlib.sha256(files.stdout.encode()).hexdigest(),
            'algorithm':'SHA-256','generated_at':datetime.now(timezone.utc).isoformat()}

if __name__ == '__main__':
    print(json.dumps(get_fingerprint(sys.argv[1]), indent=2))
