# Kitchenplaner

Kitchenplaner ist eine Desktop-App für die Planung von Profi- und Gastroküchen. Du zeichnest den
Raum, stellst Geräte und Möbel ein und siehst die Küche gleichzeitig im Grundriss, in den Ansichten
und in 3D. Alles läuft lokal auf deinem Computer; ein Projekt ist eine einzelne Datei (`.kplan`).

## Funktionen

- **Grundriss**: Raum und Geräte maßstäblich in Millimetern planen.
- **4 Ansichten**: die Wände des Raums als Ansichten, aus dem Grundriss abgeleitet.
- **3D**: die Küche räumlich ansehen.
- **Geräteliste mit Anschlusswerten**: alle Positionen mit ihren Maßen und Anschlusswerten.
- **Prüfung**: Hinweise auf Probleme in der Planung.
- **Export**: SVG, DXF, PNG und CSV; das Projekt selbst als `.kplan` (JSON).

## Installation und Entwicklung

Voraussetzungen: Rust 1.94.1 (wird über `rust-toolchain.toml` gewählt), Node.js 22 oder neuer und
die [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/) deines Systems (Windows:
Visual Studio Build Tools mit C++ und WebView2; Linux: webkit2gtk 4.1).

```
npm install
npm --prefix ui install
npm run dev      # App mit Vite-Entwicklungsserver (Port 1430)
npm run build    # Installer in target/release/bundle
```

Prüfungen vor einem Commit:

```
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm --prefix ui run typecheck
npm --prefix ui test
```

## Tastenkürzel

Auf dem Mac steht ⌘ statt Strg.

| Kürzel | Aktion |
|---|---|
| Strg+N, Strg+O, Strg+S | Neues Projekt, Öffnen, Speichern |
| Strg+Umschalt+S | Speichern unter |
| Strg+Z, Strg+Umschalt+Z / Strg+Y | Rückgängig, Wiederholen |
| Strg+D | Auswahl duplizieren |
| Strg+A | Alle Geräte auswählen |
| Entf | Auswahl löschen |
| R, Umschalt+R | 90° nach rechts / links drehen |
| Pfeiltasten (mit Umschalt) | Auswahl um 10 mm (100 mm) verschieben |
| 1, 2, 3, 4 | Grundriss, Ansichten, 3D, Alle Ansichten |
| F | Ansichten einpassen |
| Esc | Auswahl aufheben, Raumbearbeitung beenden |
| Alt beim Ziehen | Ohne Raster und Einrasten |

## English

Kitchenplaner is a desktop app for planning commercial kitchens: floor plan, four elevations and a
3D view, an equipment list with connection values, a plan check, and exports as SVG, DXF, PNG and
CSV. Projects are single `.kplan` files (JSON) on your computer. Build it with `npm install`,
`npm --prefix ui install` and `npm run dev` (development) or `npm run build` (installers). The UI is
available in German and English.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
