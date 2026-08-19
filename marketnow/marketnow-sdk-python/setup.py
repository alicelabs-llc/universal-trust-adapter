from setuptools import setup, find_packages

setup(
    name="marketnow-atc",
    version="1.0.0",
    description="Free Agent Trust Card (ATC) SDK for Python — verify agent identity, search audited MCP servers, submit for free audit",
    py_modules=["marketnow_atc"],
    install_requires=["requests>=2.0"],
    python_requires=">=3.8",
    author="AliceLabs LLC",
    author_email="info@alicelabs.site",
    url="https://marketnow.site",
    license="MIT",
    keywords=["mcp", "ai-agents", "trust", "ed25519", "security", "audit", "marketnow"],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Topic :: Security :: Cryptography",
    ],
)
