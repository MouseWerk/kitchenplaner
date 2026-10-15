# Security / Sicherheit

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub:
**Security → Report a vulnerability** in this repository
(<https://github.com/MouseWerk/kitchenplaner/security/advisories/new>).

Please include the Kitchenplaner version, your operating system, what an attacker could do and the
steps (or a file, e.g. a crafted `.kplan`) to reproduce it. The report is answered as soon as
possible; a fix is released as a new version, and the report is credited unless you prefer not to
be named.

## Supported versions

Only the latest release gets fixes. Kitchenplaner does not update itself: install the new version
from the [Releases page](https://github.com/MouseWerk/kitchenplaner/releases/latest).

## Scope

Kitchenplaner runs locally and has no server, account or network access of its own. Relevant are
mainly project files (`.kplan`) and exports: a file that makes the app run code, read or write
files outside the chosen path, or hang the app.

## Deutsch

Sicherheitslücken bitte nicht als öffentliches Issue melden, sondern vertraulich über
**Security → Report a vulnerability** in diesem Repository. Bitte Version, Betriebssystem, die
mögliche Auswirkung und die Schritte (oder eine Datei) zum Nachstellen angeben. Korrekturen
erscheinen als neue Version; unterstützt wird nur die jeweils neueste.
