# Beispielküche Restaurant Lindenhof

Eine vollständig geplante À-la-carte-Restaurantküche für rund 120 Gedecke, zum Ausprobieren und
Vorzeigen. Das Restaurant ist erfunden.

| Datei | Sprache |
| --- | --- |
| `Beispielkueche-Restaurant.kplan` | Deutsch |
| `Example-Kitchen-Restaurant.kplan` | Englisch |

**Öffnen:** In Kitchenplaner „Öffnen…“ in der Werkzeugleiste (Strg+O, am Mac Cmd+O) und eine der beiden Dateien wählen. Danach
lohnen sich Grundriss, die vier Ansichten, 3D mit Rundgang und die Geräteliste (Export als CSV).

## Kennzahlen

| | |
| --- | --- |
| Raum | L-förmig, Innenmaß 13,2 × 9,6 m, 104,6 m², 3,20 m hoch, Wände 300 mm |
| Geräte und Einrichtung | 65 Positionen |
| Anschlussleistung | 283 kW elektrisch, kein Gas |
| Abluft | 11 600 m³/h (zwei Inselhauben, Wandhaube, Bandspülmaschine) |
| Wasser | 15 Kaltwasser-, 11 Warmwasseranschlüsse, 20 Abläufe, 2 Bodenabläufe (Rinne, Gully) |
| Öffnungen | Wareneingang, Personaleingang, Tür zum Gastraum, Durchreiche am Pass, Geschirrrückgabe, Türen zu Trockenlager und Spülküche, ein Fenster |

## Die Küche

Der Gastraum liegt in der Südost-Ecke; die Küche umschließt ihn L-förmig. Alles läuft in eine
Richtung: Ware kommt von Norden herein, Speisen gehen nach Süden hinaus, schmutziges Geschirr kommt
auf eigenem Weg zurück.

- **Wareneingang und Lager (Nordwesten):** Wareneingang in der Nordwand. Gleich daneben das
  Trockenlager als eigener Raum mit Regalen und Bodenrost, die Kühlzelle an der Westwand und die
  Tiefkühlzelle an der Nordwand, beide mit 1,2 m freiem Gang vor der Tür.
- **Vorbereitung (Südwesten):** an der Trennwand zur Spülküche die Gemüsevorbereitung (Spültisch,
  Arbeitstisch mit Gemüseschneider) und die Fleisch- und Fischvorbereitung (Spültisch, Arbeitstisch
  mit Aufschnittmaschine und Vakuumierer), dazwischen ein Handwaschbecken, Wandborde über den
  Spültischen.
- **Patisserie (Mitte West):** frei stehender Arbeitstisch mit Rührmaschine und Waage, daneben der
  Schockkühler.
- **Kochwand (Nordwand):** Kippbratpfanne und Kochkessel über einer Entwässerungsrinne unter der
  Wandhaube, Kühlunterbau mit Salamander, Kombidämpfer 10 × GN 1/1 auf Untergestell und
  20 × GN 1/1, beide unter Kondensationshauben. 1,5 m Arbeitsraum vor Kessel, Pfanne und
  Kombidämpfern.
- **Kochinsel (Mitte Ost):** 900er-Linie Rücken an Rücken, 4,4 m lang. Zur Kochwand hin Nudelkocher,
  Bain-Marie, Glühplatte, Herd mit 6 Kochstellen, Wärmeschrank; zum Pass hin Doppelfritteuse,
  Lavasteingrill, Grillplatte und zwei Induktionsherde. Zwei Inselhauben decken die ganze Insel mit
  Überstand ab. Gänge: 1,5 m zur Kochwand und zum Pass, 1,2 m zur Ostwand.
- **Pass (Wand zum Gastraum):** beheizter Ausgabepass mit Wärmebrücke unter der Durchreiche,
  beheizte Tellerspender links und rechts, Saladette als kalter Posten, daneben die Tür zum
  Gastraum.
- **Spülküche (Südwest-Flügel, durch eine Trennwand abgeteilt):** Geschirrrückgabe direkt vom
  Gastraum, Vorspül- und Sortiertisch mit Abfallschacht, Korbtransportspülmaschine,
  Ablauftisch, Regale für sauberes Geschirr. An der Trennwand die Topfspüle mit Abstelltisch,
  Topfregal und Wandbord, ein Handwaschbecken und der Ausgussbecken für die Reinigung. Eine Tür
  verbindet Spülküche und Küche.
- **Hygiene:** Handwaschbecken an jedem Zugang: Vorbereitung, Kochwand, Personaleingang
  (Ostwand), Spülküche.
- **Gebäude:** eine Stütze an der Nordwand, ein Fenster in der Ostwand.

## Energie

Die Küche ist **vollelektrisch**: Induktion, Glühplatte, Grill, Grillplatte, Fritteuse,
Kippbratpfanne, Kessel und Kombidämpfer alle elektrisch, kein Gasanschluss. Das hält die Wärmelast
und die Abluft klein und erspart Gasleitung und Gasabsperrung.

## Neu erzeugen

Die Dateien werden aus `ui/src/examples/exampleKitchen.ts` erzeugt (feste Kennungen, festes Datum,
daher immer dieselben Bytes). Nach einer Änderung in `ui/`:

```
KPLAN_WRITE_EXAMPLES=1 npx vitest run src/examples
```

(PowerShell: `$env:KPLAN_WRITE_EXAMPLES = "1"; npx vitest run src/examples`). Ohne die Variable
prüft `npx vitest run src/examples`, dass die Planprüfung nichts findet, dass beide Dateien dem
Code entsprechen und dass die Kennzahlen plausibel sind.
