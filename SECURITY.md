# Security Policy

## Supported versions

Nova is currently pre-1.0. Security fixes are expected to land on the latest
`main` branch state before formal versioned support windows are established.

## Reporting a vulnerability

Please do not report security vulnerabilities in public GitHub issues,
discussions, or pull requests.

Use one of these channels instead:

1. GitHub private vulnerability reporting for this repository, if it is enabled.
2. If private reporting is not enabled, contact the maintainer privately through
   GitHub and include:
   - a clear description of the issue
   - reproduction steps
   - impact assessment
   - any suggested mitigation

## Scope

Examples of in-scope reports:

- authentication or session bypass
- privilege escalation between users, agents, or runtimes
- exposure of local credentials, runtime tokens, or attachments
- unsafe file access outside intended execution boundaries
- server-side request or command execution that crosses Nova's expected controls

Examples of out-of-scope reports:

- issues in third-party runtimes or upstream CLIs unless Nova introduces the vulnerability
- local-only development misconfiguration without a security impact
- requests for help with personal environment setup

## Disclosure

Please allow time for investigation and remediation before public disclosure.
