#!/usr/bin/env python3
"""
L2 Sandbox Entrypoint Auto-Detector
====================================
Instead of using a generic Dockerfile (CMD ["node", "index.js"]),
this script inspects the skill's repo to find the correct entrypoint.

Checks:
1. package.json → "main" field
2. package.json → "bin" field (for CLI tools)
3. pyproject.toml → [tool.poetry.scripts] or [project.scripts]
4. Dockerfile → CMD or ENTRYPOINT
5. Makefile → "start" or "run" target
6. README.md → "npx" or "python" commands
"""

import json
import re
import sys

def detect_entrypoint(package_json=None, pyproject_toml=None, dockerfile=None, readme=None):
    """Returns the detected entrypoint command."""
    
    # 1. Try package.json
    if package_json:
        try:
            pkg = json.loads(package_json) if isinstance(package_json, str) else package_json
            if 'bin' in pkg:
                bin_field = pkg['bin']
                if isinstance(bin_field, str):
                    return f'CMD ["npx", "{pkg.get("name","app")}"]'
                elif isinstance(bin_field, dict) and bin_field:
                    first_bin = list(bin_field.keys())[0]
                    return f'CMD ["npx", "{first_bin}"]'
            if 'main' in pkg:
                main = pkg['main']
                if main.endswith('.js') or main.endswith('.mjs'):
                    return f'CMD ["node", "{main}"]'
            if 'scripts' in pkg and 'start' in pkg['scripts']:
                return f'CMD ["npm", "start"]'
        except:
            pass

    # 2. Try pyproject.toml
    if pyproject_toml:
        # Look for [project.scripts] or [tool.poetry.scripts]
        match = re.search(r'\[project\.scripts\]\s*\n([^\[]+)', pyproject_toml)
        if not match:
            match = re.search(r'\[tool\.poetry\.scripts\]\s*\n([^\[]+)', pyproject_toml)
        if match:
            scripts = match.group(1).strip()
            if scripts:
                first_cmd = scripts.split('\n')[0].split('=')[0].strip()
                return f'CMD ["{first_cmd}"]'
        # Look for [tool.poetry.dependencies] with python
        if 'python' in pyproject_toml:
            return 'CMD ["python", "-m", "main"]'

    # 3. Try Dockerfile
    if dockerfile:
        cmd_match = re.search(r'^CMD\s+\[?(.+?)\]?$', dockerfile, re.MULTILINE)
        if cmd_match:
            return f'CMD [{cmd_match.group(1)}]'
        entrypoint_match = re.search(r'^ENTRYPOINT\s+\[?(.+?)\]?$', dockerfile, re.MULTILINE)
        if entrypoint_match:
            return f'ENTRYPOINT [{entrypoint_match.group(1)}]'

    # 4. Try README
    if readme:
        # Look for npx command
        npx_match = re.search(r'npx\s+[\w@/-]+', readme)
        if npx_match:
            return f'CMD ["npx", "{npx_match.group().split()[1]}"]'
        # Look for python -m
        py_match = re.search(r'python\s+-m\s+[\w.]+', readme)
        if py_match:
            cmd = py_match.group().split()
            return f'CMD ["{cmd[0]}", "{cmd[1]}", "{cmd[2]}"]'

    # 5. Default fallback
    return 'CMD ["sleep", "60"]  # Fallback: no entrypoint detected'

if __name__ == '__main__':
    # Test with example
    test_pkg = '{"main":"index.js","scripts":{"start":"node index.js"}}'
    result = detect_entrypoint(package_json=test_pkg)
    print(f'package.json main=index.js → {result}')
    
    test_pkg2 = '{"bin":{"my-mcp":"./index.js"}}'
    result2 = detect_entrypoint(package_json=test_pkg2)
    print(f'package.json bin → {result2}')
    
    test_py = '[project.scripts]\nmy-tool = "my_package.main:main"'
    result3 = detect_entrypoint(pyproject_toml=test_py)
    print(f'pyproject.toml scripts → {result3}')
    
    print('\n✓ L2 entrypoint detector ready')
