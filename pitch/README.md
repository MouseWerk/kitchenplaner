# Bilder für die Präsentation

Screenshots der echten App mit der Beispielküche „Restaurant Lindenhof“
(`examples/Beispielkueche-Restaurant.kplan`), deutsche Oberfläche, 2560 × 1440. Erzeugt mit
`e2e/docker/pitch.sh` (Skript: `e2e/pitch/shots.js`); nichts davon ist nachbearbeitet.

| Bild | Bildunterschrift |
| --- | --- |
| `01-alle-ansichten.png` | Alles auf einen Blick: Grundriss, 3D und zwei Wandansichten, links der Katalog, rechts die Anschlusswerte des Projekts. |
| `02-grundriss.png` | Der bemaßte Grundriss einer kompletten Restaurantküche mit 65 Positionen. |
| `03-grundriss-kochinsel-auswahl.png` | Mit einem Rahmen die ganze Kochinsel auswählen – die Summen stehen sofort daneben. |
| `04-3d-uebersicht.png` | Die Küche in 3D aus Südost, die Wände zur Kamera blendet die App von selbst aus. |
| `05-3d-kochinsel.png` | Nah an der Kochinsel: jedes Gerät mit seinem eigenen 3D-Modell. |
| `06-3d-begehen.png` | Begehen auf Augenhöhe: der Gang zwischen Kochwand und Kochinsel. |
| `07-3d-von-oben.png` | Von oben in Parallelprojektion – der Grundriss als 3D-Modell. |
| `08-ansichten.png` | Alle vier Wandansichten, bemaßt, direkt aus dem Grundriss abgeleitet. |
| `09-ansicht-nord.png` | Die Ansicht Nord als bemaßter Aufriss mit Positionsnummern (nur der Bereich dieser Ansicht, nicht das ganze Fenster). |
| `10-katalog-vorschau.png` | Der Katalog mit 3D-Vorschau und Anschlusswerten jedes Geräts, hier die Suche nach „kombi“. |
| `11-operator-verschieben.png` | Verschieben wie in CAD: G, X für die Achse, Maß eintippen – die Statuszeile zeigt, was passiert. |
| `12-raum-wand.png` | Raum bearbeiten: Wände mit ihren Längen, die gewählte Wand im Eigenschaftenfeld. |
| `13-inspektor-kombidaempfer.png` | Ein Gerät im Detail: Maße, Energievariante und Anschlusswerte. |
| `14-hell-alle-ansichten.png` | Dieselbe Arbeitsfläche im hellen Design. |
| `15-hell-3d.png` | Die 3D-Ansicht im hellen Design. |

## Exporte (`exports/`)

Über das Menü „Exportieren“ der App erzeugt:

| Datei | Inhalt |
| --- | --- |
| `grundriss.svg` | Grundriss als SVG mit Plankopf, in Millimetern |
| `grundriss.dxf` | Grundriss als DXF für CAD |
| `grundriss.png` | Grundriss als PNG |
| `ansichten.svg` | Alle vier Wandansichten als SVG |
| `geraeteliste.csv` | Geräteliste mit Anschlusswerten für Excel |
| `3d-ansicht.png` | 3D-Ansicht als PNG in hoher Auflösung |
