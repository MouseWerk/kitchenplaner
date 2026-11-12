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

Only the latest release gets fixes. From version 0.2.0 on, Kitchenplaner updates itself: it looks
for a new version at start and every few hours (this can be switched off in the menu „Darstellung“)
and installs it when you choose „Jetzt aktualisieren“. You can also install the new version from
the [Releases page](https://github.com/MouseWerk/kitchenplaner/releases/latest).

## Updates

The app reads the update feed `latest.json` of the latest GitHub release over HTTPS. Every update
file is signed (minisign, Ed25519) with a key that never leaves the release secrets; the app
installs a file only when its signature matches the public key built into it and the signature
names the version the feed announces, so an older release cannot be offered as a newer one. The
release checks the feed and every signature before it is published. Development builds never look
for updates.

## Scope

Kitchenplaner runs locally and has no server or account. Its only network access is the update
check above. Relevant are mainly project files (`.kplan`) and exports: a file that makes the app
run code, read or write files outside the chosen path, or hang the app. Also in scope: anything
that makes the app install an update that was not signed by the release key.

## Deutsch

Sicherheitslücken bitte nicht als öffentliches Issue melden, sondern vertraulich über
**Security → Report a vulnerability** in diesem Repository. Bitte Version, Betriebssystem, die
mögliche Auswirkung und die Schritte (oder eine Datei) zum Nachstellen angeben. Korrekturen
erscheinen als neue Version; unterstützt wird nur die jeweils neueste. Kitchenplaner aktualisiert
sich ab Version 0.2.0 selbst und installiert nur Updates, die mit dem Schlüssel der Releases
signiert sind und genau die angekündigte Version tragen.
