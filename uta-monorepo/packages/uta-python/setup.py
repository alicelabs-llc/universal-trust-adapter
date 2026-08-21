from setuptools import setup, find_packages

setup(
    name="uta-python",
    version="1.0.0",
    description="UTA Python SDK — consumer-side library for verifying UTA credentials (ATC v3, JWT, VC, A2A, EAT, ZTA, MCP)",
    author="AliceLabs LLC",
    author_email="info@alicelabs.site",
    license="AL-1.0",
    url="https://github.com/eddyflores100-lang/universal-trust-adapter",
    packages=find_packages(),
    install_requires=[
        "cryptography>=41.0.0",
    ],
    python_requires=">=3.9",
    classifiers=[
        "License :: Other/Proprietary License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Security :: Cryptography",
    ],
)
