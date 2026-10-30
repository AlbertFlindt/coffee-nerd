# Security

## Supported versions

Only the latest release gets security fixes. Update to it before you report a problem.

## Reporting a vulnerability

Report it privately, not in a public issue: on GitHub, open the repository's **Security** tab and
choose **Report a vulnerability**. Say what is affected, how to reproduce it and what an attacker
gains. You get an answer within a week, and a fix is released as a patch version and named in the
CHANGELOG.

## What Coffee Nerd protects

Coffee Nerd runs on your own server and makes no outside requests. Passwords are stored as salted
hashes, and sign-in slows down after repeated wrong passwords. An installed app keeps recent pages
and unsent shots on the phone, so lock the phone. Keep in mind:

- **Claim it first.** Until an account exists, anyone who can reach the server can create one.
  Create yours right after starting the app.
- **Use https.** Over plain http, the password and session cookie cross the network unencrypted,
  and installing the app and offline use don't work.
- **Guard your backups.** A backup is the whole database, including every account's password hash.
- **Change the Demo password.** The sample setup signs in as "Demo" with a published password. Set
  your own with `node scripts/reset-password.mjs` before anyone else can reach the server.
