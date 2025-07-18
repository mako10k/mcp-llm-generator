# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in this project, please report it by:

1. **GitHub Security Advisories** (preferred): Use the "Security" tab in this repository to report a vulnerability privately.
2. **Email**: Send details to the maintainer via GitHub contact information.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

## Security Best Practices

This package follows these security practices:
- Regular dependency audits via `npm audit`
- Automated security scanning with Dependabot
- Minimal dependencies to reduce attack surface
- No hardcoded secrets or credentials
- Input validation using Zod schemas

## Dependency Security

- All dependencies are regularly updated
- Security vulnerabilities are addressed promptly
- We use `npm audit` in CI/CD pipeline

## Support Timeline

- **v1.x**: Security fixes until December 2025
- Future major versions will be announced 6 months before deprecating previous versions
