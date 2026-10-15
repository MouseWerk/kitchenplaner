# Kitchenplaner: Brainstorm und Roadmap (Stand 15.10.2026, Version 0.1.0)

Kurz gehalten: erst was ein Profi heute erwartet, dann Ecken im Code, dann Ideen mit
Nutzen, Aufwand und Empfehlung, am Ende die Roadmap 0.2 bis 0.4. Belege stehen bei den Aussagen,
die Quellenliste ganz unten. Was ich nicht belegen konnte, ist mit **(unsicher)** markiert.

---

## 0. Wie Profis heute planen (Recherche, kurz)

**Werkzeuge**
- Fachplaner und Planungsabteilungen der Händler zeichnen fast immer in **AutoCAD**, zunehmend
  **Revit**. Stellenanzeigen für Großküchenplaner nennen AutoCAD/Revit, „Entwurfs- und
  Ausführungspläne“ und ausdrücklich „Installationspläne“ [1][2][3].
- Geräte kommen als **CAD-Blöcke bzw. Revit-Familien der Hersteller**. In den USA bündelt **KCL**
  (seit 2023 bei Revalize, zusammen mit **AutoQuotes**, dem Preis-/Spezifikationskatalog) mehr als
  200 000 DWG-Dateien und Revit-Familien und hat mit „NapkinSketch“ ein Planen ohne CAD [4][5].
  Revalize will Design, AQ-Katalog und Angebotssoftware (CPQ) zu einem Ablauf verbinden [4].
- **ProKitchen** (Real View) verkauft Planung mit Herstellerkatalogen als Abo, 1 695 bis 2 295 USD
  pro Jahr laut eigener Preisseite; der Katalogzugang ist der Preistreiber [6].
- **pCon.planner** mit **OFML**-Daten: ursprünglich Büromöbel, aber einzelne Großküchenhersteller
  (z. B. KBS Gastrotechnik) haben Kataloge dort; Angebotserstellung inklusive, Datenupdates
  kostenpflichtig [7].
- Ein Planungsbüro beschreibt, dass es in Archicad arbeitet und Geräteobjekte aus AutoCAD-Blöcken
  der Hersteller selbst baut [8] – ein Hinweis, dass Herstellerdaten oft nur als DWG vorliegen.
- **Deutsche Spezialsoftware** für Großküchenplanung konnte ich nicht belastbar finden
  **(unsicher – lohnt eine gezielte Marktrecherche: Messen INTERNORGA/HOST, Verband HKI, FCSI
  Deutschland)**.

**Typische Lieferungen eines Planers** (aus Praxis und Stellenprofilen [1][2][3], Gewichtung meine
Einschätzung)
1. Aufstellungsplan (Grundriss mit Positionsnummern) – hat Kitchenplaner.
2. **Installationsplan / Anschlussplan** je Gewerk: Elektro (kW, V, Absicherung), Kalt-/Warmwasser,
   Abwasser, Bodenablauf, Gas, Abluft/Zuluft – **mit Lage und Höhe jedes Anschlusspunkts**,
   bemaßt ab Wand/Fertigfußboden. Das ist das, was Elektriker und Installateur bekommen. Fehlt.
3. Geräteliste / **Leistungsverzeichnis** mit Hersteller, Typ, Artikelnummer, Preis, Text. Hat
   Kitchenplaner ohne Hersteller/Preis.
4. Ansichten und Schnitte – hat Kitchenplaner (Wandabwicklungen).
5. 3D-Visualisierung für den Bauherrn – hat Kitchenplaner.
6. Grundlagen für den Lüftungsplaner: Wärmeabgabe (sensibel/latent) je Gerät. Die BGN beschreibt
   den Ablauf so: Planer und Betreiber wählen die Geräte, der Hersteller liefert Wärme- und
   Dampfdaten, danach legt der Lüftungsplaner aus [9].

**Normen und Regeln**
- **VDI 2052 Blatt 1 (2017)** und **DIN EN 16282-1 (2017)**: Lüftung gewerblicher Küchen;
  Abluftvolumenströme über Gerätetabellen „A1“ und Gleichzeitigkeit; Teil 2 Hauben (2018),
  Teil 3 Lüftungsdecken (2021) [9][10]. VDI 2052 gilt laut Linear-Doku nicht für Küchen unter
  25 kW Wärme/Feuchte abgebender Anschlussleistung [11].
- **DIN 18865 ist keine Planungsnorm**, sondern eine Produktnormreihe für Ausgabeanlagen
  (Warmausgaben, Tablettrutschen, Einbaustapelgeräte…) [12]. Also nicht als „Planungsnorm“
  bewerben.
- **DGUV Regel 110-002 (Arbeiten in Küchenbetrieben)**, ASR A1.2 (Bewegungsflächen), ASR A1.8
  (Verkehrswege): je Arbeitsplatz mind. 1,5 m² freie Bewegungsfläche, nirgends schmaler als 1,0 m
  [13]. Konkrete Gangbreiten aus 3.2.3 habe ich nicht im Wortlaut gefunden **(unsicher, im
  Original prüfen)**.
- **Hygiene**: VO (EG) 852/2004, Schwarz-Weiß-Trennung (Warenannahme, Spüle, Sozialräume getrennt
  von Lebensmittelbereichen), Lagertemperaturen nach DIN 10508 [14].
- **Gastronorm EN 631-1**: GN 1/1 = 530 × 325 mm, Teilmaße daraus [15].
- **Gleichzeitigkeit Elektro**: keine Normtabelle gefunden. Eine Rational-Fallstudie nennt gemessen
  rund 0,32 für die 15-min-Spitze [16] (Herstellerangabe). Energieoptimierungsanlagen nach
  DIN 18875 werden in der HKI-CERT-Datenbank als Merkmal geführt [17].

**Herstellerdaten**
- **FCSI-Revit-Standard** (2022) für Foodservice-Familien, **IFSE** Parameter Data Dictionary [18].
- **HKI CERT Großküchentechnik**: Energieverbrauchs-Datenbank deutscher Hersteller (DIN 18873),
  mit Anschlussleistung; ob es einen Export für Planungssoftware gibt, ist offen **(unsicher)** [17].
- **GS1 GDSN** trägt Produktstammdaten (GTIN), seit 2024 auch ETIM-Merkmale; Geometrie oder
  Anschlusspunkte nicht [19]. **BIMobject** und Hersteller-Downloadseiten liefern RFA/IFC [20].

**Schmerzpunkte (abgeleitet, teils Einschätzung)**
- AutoCAD/Revit sind teuer und für die Küche „zu allgemein“; Blöcke der Hersteller sind
  uneinheitlich (daher FCSI-Standard [18]).
- Anschlusspläne werden von Hand aus Datenblättern abgetippt – Fehlerquelle Nr. 1 auf der
  Baustelle **(Einschätzung)**.
- Änderungen (Gerät tauschen) ziehen Plan, Liste, Anschlussplan und Angebot nach sich; ohne
  Verknüpfung wird das inkonsistent **(Einschätzung)**.
- Händler brauchen schnell ein Angebot mit 3D für den Gastronomen, der Fachplaner die
  Ausführungsplanung für TGA – zwei unterschiedliche Kunden.

**Was daraus für Kitchenplaner folgt:** Das Alleinstellungsmerkmal ist „Plan, Ansichten, 3D,
Geräteliste **und Anschlussplan** aus einem Modell, lokal, ohne AutoCAD“. Der Anschlussplan ist der
größte fehlende Baustein; danach PDF-Planausgabe und Preise.

---

## 1. Fehler und raue Kanten (aus Code und Doku)

| # | Was | Wo | Warum es beißt | Aufwand |
|---|---|---|---|---|
| B1 | **Positionsnummern = Reihenfolge im Array.** Löschen oder Umsortieren nummeriert alle folgenden Geräte neu. | `ui/src/model/project.ts:75` `positions()` | Ein Profi verschickt Plan Rev. A mit Pos. 23 = Kombidämpfer; nach einer Löschung ist Pos. 23 etwas anderes. Plan, Liste, Angebot und Rückfragen auf der Baustelle laufen auseinander. Positionsnummern müssen stabil im Item gespeichert werden (mit „neu nummerieren“ als bewusster Aktion). | M (Feld `pos`, Migration, Version +1) |
| B2 | **Anschlusswerte sind Richtwerte, die App sagt es nicht.** Der Kommentar in `kinds/cooking/entries.ts` sagt „typical starting points, not a manufacturer's“, im UI und im CSV steht nichts davon. | Katalog, Inspector, CSV, Plankopf | Ein Elektriker dimensioniert nach der CSV. Haftungs- und Glaubwürdigkeitsrisiko. Hinweis im Katalog, im Inspector („Richtwert, mit Herstellerdatenblatt prüfen“) und eine Fußzeile im Export. | S |
| B3 | **Summen ohne Gleichzeitigkeit**: Elektro-, Gas- und Abluftsumme sind reine Additionen. | `model/equipment.ts` `equipmentTotals` | 283 kW in der Beispielküche wirken für einen Hausanschluss abschreckend hoch; realer Spitzenwert deutlich niedriger [16]. Mindestens „Anschlussleistung (Summe)“ klar benennen und einen einstellbaren Gleichzeitigkeitsfaktor anbieten. | S |
| B4 | **Anschlussmodell zu dünn**: kein Strom in A / Absicherung, keine Phasenzahl außer 230/400, keine Anschlussgröße (DN, Zoll), keine Zuluft, keine Wärmeabgabe, kein Dampf, kein enthärtetes Wasser, kein Fettabscheider-relevanter Ablauf, keine Kälte (Remote-Aggregat), **keine Lage/Höhe der Anschlusspunkte**. | `model/types.ts` `Connections` | Ohne Lage und Höhe ist kein Installationsplan möglich; ohne Wärmeabgabe nichts für den Lüftungsplaner [9]. Fundament für die wichtigste Funktion. | M |
| B5 | **Türen immer am Anfang angeschlagen und nach innen öffnend**, keine Wahl von Anschlagseite, Aufschlagrichtung, zweiflügelig, Schiebetür. | `model/types.ts` `Opening`, `model/plan.ts:48/307`, `checks.ts` `doorClearances` | Fluchttüren schlagen nach außen auf; Kühlzellentüren, Pendeltüren und Schiebetüren sind in Küchen normal. Plan und Türprüfung sind dann schlicht falsch. | S–M |
| B6 | **Ansichten nur für die vier Himmelsrichtungen.** Eine Wand zählt nur, wenn sie innerhalb ~25° zur Blickrichtung steht. | `model/elevation.ts` `VIEW_DIR`, `WALL_FACES_VIEWER` | Schräge Wände (45°-Fasen, die der Wandzeichner anbietet) bekommen keine eigene Abwicklung; ihre Geräte erscheinen verzerrt oder gar nicht. Abhilfe: Abwicklung je Wand (oder je Wandzug) statt je Himmelsrichtung. | M |
| B7 | **DXF**: R12 (AC1009) mit `$INSUNITS`, das erst ab R2000 existiert; Geräte als lose Linien statt BLOCK mit Attributen (Pos., Name, kW); Layer nach Strichart statt nach Gewerk. | `render/dxf.ts` | Ein Planer will im CAD ein Gerät anklicken und verschieben, Layer „E-Anschluss“ ausblenden. Lose Linien = Nacharbeit. AutoCAD ignoriert `$INSUNITS` in R12 vermutlich und fragt nach Einheiten **(unsicher, mit AutoCAD/BricsCAD testen)**. | M |
| B8 | **Kein Autosave / keine Wiederherstellung** nach Absturz; nur Rückfrage beim Schließen. | `App.tsx` (onCloseRequested), Store | WebView-Absturz oder Stromausfall nach zwei Stunden Planung = alles weg. Kleine Lösung: periodische Sicherungskopie über einen eigenen Rust-Befehl ins App-Datenverzeichnis, beim Start anbieten. | S–M |
| B9 | **Planausgabe nur A3 quer**, Maßstab automatisch (1:20 bis 1:500), kein PDF, kein Drucken. | `render/svg.ts` `SHEET_W/H`, `SHEET_SCALES` | Profis liefern PDF in fester Maßstabsangabe (1:50) auf A3/A1/A0 mit Plannummer und Revisionsindex. SVG ist für Bauherren nicht „öffnebar“. | M (PDF), S (Papierformat/Maßstab wählbar) |
| B10 | **Plankopf ohne Plannummer, Index/Revision, Planart, Büro-Logo**. | `render/svg.ts` `sheetDrawing` | Ohne Index keine Planverwaltung; ohne Logo kein Händler-Einsatz. | S |
| B11 | **Planprüfung kennt keine Gangbreiten, keine Haubenüberdeckung, keine Handwaschbecken-Pflicht, keine Bewegungsflächen.** | `model/checks.ts` | Genau das prüfen Behörde/BG; die Beispielküche hält es ein, die Prüfung weiß es aber nicht. Siehe Idee P4. | M |
| B12 | **Noch keine Release-Notes**: `docs/releases/` ist leer, obwohl CLAUDE.md sie für jede Version verlangt. | `docs/releases/` | Erster öffentlicher Eindruck. | S |
| B13 | **Windows unsigniert, macOS ad hoc signiert** (bewusste Entscheidung). SmartScreen bzw. Gatekeeper warnen beim ersten Start. | `tauri.conf.json` | Für Fachplaner in Firmen-IT oft ein Ausschlussgrund. Mindestens eine bebilderte Installationsanleitung („Weitere Informationen → Trotzdem ausführen“, macOS „Rechtsklick → Öffnen“) auf der Website/README. | S |
| B14 | **Generische Gerätenamen ohne Hersteller/Artikelnummer**; Geräteliste hat kein Feld dafür. | `model/types.ts` `Item`, `equipment.ts` | Für ein LV/Angebot unbrauchbar. Freitextfelder Hersteller, Typ, Artikelnr., Preis wären der erste Schritt (siehe D1, P6). | S |

Kleinigkeiten, die mir auffielen, aber nicht kritisch sind: Rückgängig speichert bis zu 200 volle
Projektzustände (bei sehr großen Projekten Speicher, heute unkritisch); Drehen nur in 15°-Stufen ohne
Alt (für schräge Wände braucht es „an Wand ausrichten“).

---

## 2. Ideen

Legende Aufwand: **S** bis ca. 2 Tage, **M** ca. 1–2 Wochen, **L** mehrere Wochen. Empfehlung:
**Ja** (bald), **Später**, **Nein/Parken**.

### 2.1 Planung

| Idee | Nutzen (wer, warum) | Aufwand | Abhängigkeiten | Empfehlung |
|---|---|---|---|---|
| **P1 Installationsplan / Anschlussplan** – Anschlusspunkte je Gerät (E, KW, WW, AW, BA, Gas, Abluft) im Gerät definiert (Lage relativ zum Gerät + Höhe ü. FFB), automatisch in Raumkoordinaten, eigene Symbole, Bemaßung ab Wand, Höhentabelle, eigenes Blatt je Gewerk. | Fachplaner, Elektriker, Installateur: **die** Lieferung, die heute von Hand entsteht. Größtes Alleinstellungsmerkmal gegenüber „Zeichenprogramm“. | L | B4 (Anschlussmodell), Symbole, Plankopf | **Ja, Kern von 0.3** |
| P2 Medienplan / Gewerke-Layer: Ansicht „nur Elektro“, „nur Sanitär“ ein/aus, in Plan, Export und DXF-Layern. | Planer übergibt Gewerken saubere Pläne. | M | P1, B7 | Ja, mit P1 |
| P3 Wärmeabgabe und Abluftabschätzung: sensible/latente Wärme je Gerät, Haube deckt Gerät ab?, grobe Summe nach VDI 2052-Logik **als Richtwert**. | Lüftungsplaner bekommt Grundlagen [9]; Händler sieht früh die Größenordnung. | M | B4; Tabellenwerte aus VDI 2052 dürfen nicht kopiert werden (Urheberrecht der Norm) – Werte nur aus Herstellerdaten oder eigene Richtwerte | Später (0.4), nur als „Hilfe, kein Nachweis“ |
| **P4 Prüfung erweitern**: Mindestgangbreite (einstellbar, Vorschlag 1,0/1,2/1,5 m), freie Fläche vor Kühlzellen- und Ofentüren, Haube überdeckt Kochgerät mit Überstand, Gerät mit Wasser/Ablauf frei im Raum (Insel → Bodenanschluss nötig), Handwaschbecken im Bereich vorhanden, Gasgerät ohne Haube. | Glaubwürdigkeit bei Profis; spart Fehler, die sonst die BG/Behörde findet [13]. | M | Grenzwerte als Einstellung, nicht als „Norm erfüllt“ formulieren | **Ja (0.2 teilweise, 0.3 Rest)** |
| P5 Arbeitszonen/Bereiche mit m²: Polygon „Spülküche“, „Kühllager“, „Vorbereitung Fleisch“ mit Fläche, Farbe, Raumbuch-Tabelle. | Raumprogramm mit Bauherr/Architekt abstimmen; Flächen sind Verhandlungsgrundlage. | M | Raum-Modus | Ja (0.3) |
| P6 Flusspfeile rein/unrein (Ware, Speisen, Geschirr, Abfall, Personal) als Zeichenobjekte mit Farbe/Strichart, eigene Legende; optional Kreuzungswarnung. | HACCP-Konzept und Behördengespräch; schönes Pitch-Bild [14]. | S–M (Pfeile), M (Prüfung) | Layer | Ja (0.3), Prüfung später |
| P7 **Kalkulation/Angebot**: Preis, Rabatt, Montage, Fracht je Position, Summen, MwSt; eigene Preisliste (CSV-Import). | Händler und Fachhandel: Angebot direkt aus der Planung; das, wofür KCL/AutoQuotes Geld nimmt [4][5]. | M (Basis), L (Preislisten, Varianten) | B14, D3 (Excel) | **Ja (0.3 Basis)** |
| P8 Varianten und Revisionen: mehrere Varianten in einer Datei (Gas vs. Elektro), Revisionsindex mit Änderungsliste („Pos. 12 getauscht“). | Planer arbeitet immer in Indizes; Vergleich für Bauherr. | M–L | B1 (stabile Pos.), Format-Version | Später (0.4) |
| P9 Ebenen/Layer frei (Bestand, Abbruch, Neu; Gewerke; Möblierung). | CAD-Gewohnheit; Umbau-Projekte. | M | P2 | Später |
| P10 Bestandsplan als Unterlage: PDF/PNG/DXF des Architekten importieren, skalieren (zwei Punkte, Länge eintippen), abpausen. | Fast jedes Projekt startet mit einem Architektenplan. Riesige Zeitersparnis beim Raumzeichnen. | M (Bild), L (DXF) | Rust für PDF-Rasterung (siehe R1) | **Ja (0.2 als Bild)** |
| P11 Kühlzellen-Konfigurator (Paneele, Tür, Aggregat, Bodenrahmen) und Edelstahl-Sonderbau (Tische mit Becken, Aufkantung, Ausschnitten nach Maß). | Sonderbau ist im Gastrobereich die Regel; Händler verdienen daran. | L | Kind-System | Später |
| P12 GN-Raster in Geräten (z. B. Saladette 3 × GN 1/3) als Info und in der Liste [15]. | Kleiner, sichtbarer Profi-Hinweis. | S | Katalog | Später, nice-to-have |

### 2.2 Daten

| Idee | Nutzen | Aufwand | Abhängigkeiten | Empfehlung |
|---|---|---|---|---|
| **D1 Herstellerdaten am Gerät**: Hersteller, Typ, Artikelnr., Preis, Link zum Datenblatt; Gerät „generisch“ vs. „konkret“. | Basis für LV, Angebot, glaubwürdige Anschlusswerte. | S | B14 | **Ja (0.2)** |
| D2 Eigene Kataloge / Herstellerkatalog-Import: JSON- oder CSV-Format (Maße, Anschlüsse, Anschlusspunkte, Preis, Kind für die Darstellung) als Datei neben der App; später Import von FCSI-Parametern [18]. | Händler/Hersteller bringen ihr Sortiment mit; macht die App für Hersteller interessant. | M (Format + Import), L (3D-Modelle aus GLB/IFC) | D1, B4, Rust-Befehl zum Lesen eines Katalogordners | Ja (0.3 Format, 0.4 Import) |
| **D3 PDF-Export mit Plankopf und mehreren Blättern** (Grundriss, Ansichten, Anschlussplan, Geräteliste, 3D-Bild) in einem Satz; Papierformat und Maßstab wählbar. | Das Format, das Bauherr, Architekt und Gewerke erwarten. | M | B9, B10; Umsetzung in Rust (R1) oder TS (z. B. pdf-lib, alles lokal, CSP-tauglich) | **Ja (0.2)** |
| D4 Geräteliste als **Excel (.xlsx)** mit Formatierung, Summen und Preisen; zusätzlich als PDF-Blatt. | Händler und Einkäufer leben in Excel; CSV-Trennzeichen-Probleme entfallen. | S–M | P7 | Ja (0.3) |
| D5 DXF verbessern: Blöcke mit Attributen, Gewerke-Layer, R2000+ (AC1015) | Planer arbeiten im CAD weiter (B7). | M | P2 | Ja (0.3) |
| D6 DWG lesen/schreiben | Viele Architektenpläne kommen als DWG. Offene Bibliotheken (LibreDWG) sind GPL **(Lizenzkonflikt mit MIT prüfen)**; ODA-SDK kostet. | L | Rust | Nein/Parken; DXF reicht, DWG→DXF macht der Architekt |
| D7 IFC-Export (IfcFurnishingElement/IfcFlowTerminal mit Property Sets: Pos., kW, Anschlüsse) | BIM-Projekte (öffentliche Hand, Kliniken, Mensen) verlangen zunehmend IFC; TGA-Planer kann Anschlüsse übernehmen. | L | B4, P1; Rust-Crate oder eigener STEP-Writer | Später (0.4+), aber strategisch wichtig |
| D8 IFC-Import des Gebäudes (Wände/Räume als Unterlage) | Start aus dem Architektenmodell. | L | D7 | Parken |
| D9 GDSN/ETIM/HKI-Anbindung | Stammdaten ohne Geometrie [17][19]; Zugang meist kostenpflichtig/vertraglich. | L | Partner | Parken, erst mit Herstellerpartner |
| D10 Projektvorlagen (Raumform + Grundausstattung: Imbiss, Bistro, Mensa 300 Essen, Hotel-Frühstück) | Schneller Start, gute Demo. | S | – | Ja (0.2) |

### 2.3 Zusammenarbeit

| Idee | Nutzen | Aufwand | Abhängigkeiten | Empfehlung |
|---|---|---|---|---|
| Z1 **Präsentationsmodus**: Vollbild, ruhige Oberfläche, gespeicherte Kamerastandpunkte („Szenen“), Klick durch Plan → 3D-Rundgang → Geräteliste. | Händler beim Gastronomen; der Moment, in dem verkauft wird. | M | 3D-Kameras speichern | **Ja (0.3)** |
| Z2 Kommentare/Markierungen im Plan (Notiz mit Pfeil, Status offen/erledigt) in der .kplan. | Abstimmung Planer ↔ Bauherr ↔ Gewerk; Wolkenmarkierungen wie im CAD. | M | – | Später (0.4) |
| Z3 Revisionen/Versionen mit Vergleich (was hat sich geändert) | siehe P8 | M–L | B1 | Später |
| Z4 Teilen-Link / Web-Viewer (read-only, 3D im Browser) | Bauherr ohne Installation. Bricht mit „lokal, ohne Server“ und braucht Hosting. | L | Server, Datenschutz | Nein/Parken; Alternative: **3D als eigenständige HTML-Datei exportieren** (offline öffnbar) – M, Später |
| Z5 Dateiüberwachung: geänderte .kplan von außen erkennen (Netzlaufwerk, Kollege) | Teams auf Netzlaufwerken. | S–M | Rust (notify-Crate) | Später |

### 2.4 3D

| Idee | Nutzen | Aufwand | Abhängigkeiten | Empfehlung |
|---|---|---|---|---|
| G1 Materialien: Fliesen-/Wandfarben, Edelstahlvarianten, Arbeitsplatten wählbar je Raum/Gerät. | Bauherr erkennt „seine“ Küche. | M | look.ts | Später (0.4) |
| G2 Bessere Beleuchtung/Render: Umgebungslicht (HDR lokal mitgeliefert), Ambient Occlusion vorhanden?, „Rendern“-Knopf mit progressivem Pathtracing (three-gpu-pathtracer) für ein Standbild. | Pitch- und Angebotsbilder. | M | Lizenz der Bibliothek prüfen | Später |
| G3 Gespeicherte Ansichten/Kamerafahrten, Video-Export des Rundgangs | Präsentation, Social Media des Händlers. | M | Z1 | Später |
| G4 Anschlusspunkte und Medien in 3D (farbige Stutzen) | Kontrolle der Installationsplanung räumlich. | S nach P1 | P1 | Ja mit P1 |
| G5 VR (WebXR) | In WebView2/WKWebView praktisch nicht verfügbar **(unsicher)**; Nische. | L | – | Nein |
| G6 Herstellermodelle (GLB/glTF) statt Prozedurmodell | Echte Optik der Geräte. | M | D2 | Später (0.4) |

### 2.5 Bedienung

| Idee | Nutzen | Aufwand | Empfehlung |
|---|---|---|---|
| O1 **Messwerkzeug** (Abstand zwei Punkte, Kettenmaß) und **freie Bemaßung**, die im Plan bleibt und exportiert wird | Jeder Planer misst ständig; eigene Maßketten gehören auf jeden Ausführungsplan. | M | **Ja (0.2 Messen, 0.3 Bemaßung)** |
| O2 Befehlspalette (Strg+K / F3 wie Blender) mit Suche über alle Befehle und Katalog | Passt zur Blender-Bedienung, macht Tastatur-Profis schnell, Funktionen werden auffindbar. | S–M | Ja (0.2) |
| O3 Ausrichten/Verteilen (links, Mitte, gleiche Abstände), „an Wand ausrichten“ für schräge Wände | Saubere Linien, schräge Räume. | S | Ja (0.2) |
| O4 Gruppen (Kochinsel als Einheit) und Sperren (Bauteile, Bestand) | Große Küchen beherrschbar; versehentliches Verschieben von Stützen verhindern. | M | Ja (0.3) |
| O5 Linienzug/„Küchenzeile“: Geräte automatisch an eine Wand reihen, Abdeckblenden/Passstücke für Restmaß | Typischer Arbeitsschritt; Restmaß ist ein echtes Thema. | M | Später |
| O6 Kontextmenü (Rechtsklick außerhalb von Operatoren) | Entdeckbarkeit für Nicht-Blender-Nutzer. | S | Ja (0.2) |
| O7 Onboarding: kurze Einführung beim ersten Start, Kürzel-Übersicht mit „?“ | Blender-Bedienung ist ungewohnt für AutoCAD-Leute; ohne Hilfe brechen Tester ab. | S | **Ja (0.2)** |

### 2.6 Rust-Kandidaten (wo es sich lohnt)

| Idee | Warum Rust | Aufwand | Empfehlung |
|---|---|---|---|
| R1 PDF-Erzeugung (Vektor, mehrere Blätter, eingebettete Schrift) | Saubere Vektor-PDFs, große Pläne, keine Canvas-Rasterung; Crates wie `printpdf`/`krilla` **(Reife prüfen)**. Alternativ TS-Bibliothek im UI – einfacher, kein neuer Befehl. | M | Entscheiden nach Prototyp; Tendenz TS zuerst, Rust wenn Qualität/Größe nicht reicht |
| R2 PDF/Bild-Unterlage rastern (P10) | PDF-Rendering braucht pdfium o. ä.; lizenzrechtlich und Größe prüfen. | M | Später; zuerst PNG/JPG-Unterlage |
| R3 Autosave/Sicherungskopie (B8) | Muss atomar und außerhalb des Benutzerpfads schreiben; passt zu `write_atomic`. | S | **Ja** |
| R4 Katalogordner lesen (D2) | Neue Command, Größenlimit, Validierung wie bei `read_project`. | S | Ja mit D2 |
| R5 CLI (`kitchenplaner export plan.kplan --pdf`) | Händler mit Automatisierung, CI für Beispiele; braucht die Renderlogik, die aber in TS liegt → nur mit Node/Deno-Bundle sinnvoll **(Architekturfrage)**. | M–L | Parken |
| R6 IFC/DXF-Schreiber in Rust | Große Dateien, Tests ohne UI. Aber DXF läuft in TS gut. | M–L | Nur IFC, später |
| R7 Dateiüberwachung (Z5) | `notify`-Crate, Event an UI. | S | Später |

Allgemein: Die Arbeit liegt heute bewusst im UI; Rust lohnt nur bei Binärformaten (PDF, IFC),
Dateisystem (Autosave, Kataloge, Watch) und Robustheit. Keine Planungslogik nach Rust verschieben.

### 2.7 Plattform

| Idee | Nutzen | Aufwand | Empfehlung |
|---|---|---|---|
| X1 **Website** (eine Seite: Bilder aus `pitch/`, Download-Links auf GitHub-Releases, Installationshinweise zu SmartScreen/Gatekeeper, Beispielküche) | Erster Eindruck, Auffindbarkeit („Großküche planen Software“). | S | **Ja (0.2)** |
| X2 winget-Manifest (zeigt auf das GitHub-Release, kein Store-Konto nötig) | IT-Abteilungen installieren per winget; geringe Kosten. **Widerspricht ggf. „kein Store-Build“ – winget ist kein Store-Build, aber bitte entscheiden.** | S | Ja, nach Entscheidung |
| X3 Microsoft Store (MSIX, Store signiert selbst) | Löst die SmartScreen-Warnung ohne gekauftes Zertifikat **(nach meinem Kenntnisstand signiert Microsoft Store-Pakete selbst; prüfen)**. **Widerspricht der Owner-Entscheidung „kein Store-Build“.** | M | Entscheidung bei dir; ich halte es für den günstigsten Weg zu „ohne Warnung“ |
| X4 Auto-Update | **Widerspricht „kein Updater“.** Ersatz: beim Start (optional, abschaltbar) nur prüfen und auf die Release-Seite verlinken? Auch das braucht eine Netzwerkverbindung und eine CSP-Ausnahme. | S–M | Nein, solange die Entscheidung gilt; „Über“-Dialog mit Versionsnummer und Link reicht |
| X5 Absturzbericht lokal (Log-Datei, „Bericht kopieren“) | Support ohne Telemetrie. | S | Ja (0.2) |

### 2.8 Pitch und Geschäft

**Zielgruppen (meine Einschätzung, nicht belegt)**

| Gruppe | Was sie braucht | Zahlungsbereitschaft |
|---|---|---|
| **Großküchen-Fachhändler / Großhändler** (Planungsabteilung, Außendienst) | Schnell vom Aufmaß zu Plan + 3D + Angebot; eigene Preisliste; Logo im Plankopf | Hoch, pro Arbeitsplatz; heute AutoCAD + Excel |
| **Fachplaner (FCSI-Planer, Ingenieurbüros)** | Ausführungsplanung: Anschlussplan, DXF/IFC, Revisionen, Norm-Nähe | Mittel bis hoch, aber sehr CAD-gebunden; schwerster Markt |
| **Hersteller** (Gerätebauer, Edelstahl-Sonderbau) | Ihre Produkte im Planungswerkzeug, Leads | Zahlt für Katalogpräsenz (Modell KCL/pCon [4][7]) |
| **Gastronomen, Architekten, Berufsschulen** | Ideen-/Raumprogramm-Phase, Lehre | Gering; gut für Verbreitung |

**Preisideen**
- Kern bleibt **MIT und kostenlos** (Vertrauen, Verbreitung, Schulen). Geld dann über:
  1. **„Pro“-Paket für Händler** (eigene Preislisten, Angebots-PDF mit Logo, Excel-Export,
     Herstellerkataloge): Jahreslizenz pro Arbeitsplatz. Orientierung: ProKitchen 1 695–2 295 USD
     pro Jahr [6] – ein deutlich günstigerer Einstieg (z. B. 300–600 € pro Jahr) ist plausibel
     **(Preisfindung ungeprüft)**. Achtung: mit MIT-Lizenz braucht ein Pro-Paket getrennten,
     nicht offenen Code oder ein Datenprodukt.
  2. **Katalogpräsenz für Hersteller** (Datenpflege nach eigenem Katalogformat D2, Freigabe in der
     App) – das skaliert, ohne Nutzer zu belasten.
  3. **Dienstleistung**: Einrichten von Händlerkatalogen und Vorlagen.
- Vorschlag: erst 0.2/0.3 kostenlos breit testen lassen (5–10 Händler/Planer), dann über Pro
  entscheiden.

**Pitch-Satz:** „Vom leeren Raum zu Aufstellungsplan, Anschlussplan, Geräteliste und 3D-Rundgang
an einem Nachmittag – ohne AutoCAD, alles aus einem Modell, auf deinem Computer.“
(Der Anschlussplan-Teil gilt erst ab 0.3.)

---

## 3. Top 10 Empfehlungen

1. **Stabile Positionsnummern** (B1) – ohne sie ist jede verschickte Unterlage nach der nächsten
   Änderung falsch.
2. **Richtwert-Hinweis** für Anschlusswerte in Katalog, Inspector und Exporten (B2) und
   **Gleichzeitigkeitsfaktor** für die Summen (B3).
3. **PDF-Planausgabe** mit Papierformat, Maßstab, Plannummer, Index, Logo, mehreren Blättern (D3, B9, B10).
4. **Installationsplan/Anschlussplan** mit Anschlusspunkten (Lage + Höhe) je Gerät und Gewerke-Layern (P1, P2, B4).
5. **Türen richtig**: Anschlagseite, Aufschlagrichtung, zweiflügelig, Schiebetür (B5).
6. **Prüfung erweitern**: Gangbreiten, Haubenüberdeckung, Bewegungsfläche, Handwaschbecken (P4).
7. **Herstellerfelder + Preise am Gerät** und einfache **Kalkulation** mit Excel-Export (D1, P7, D4).
8. **Unterlage importieren** (Architektenplan als Bild, skalieren, abpausen) (P10).
9. **Messen/Bemaßen, Befehlspalette, Onboarding** (O1, O2, O7) – macht die Blender-Bedienung für CAD-Leute zugänglich.
10. **Autosave/Wiederherstellung** (B8) plus **Website mit Installationshilfe** (X1, B13) für einen sauberen öffentlichen Start.

---

## 4. Roadmap

### 0.2 – „Glaubwürdig für Profis“ (öffentlicher Erstauftritt)
1. Stabile Positionsnummern im Item, „Neu nummerieren“ als Befehl, Dateiversion +1 mit Migration (B1).
2. Richtwert-Hinweise für Anschlusswerte; Summe als „Anschlussleistung“ benannt plus einstellbarer Gleichzeitigkeitsfaktor (B2, B3).
3. Türen: Anschlagseite, Aufschlag innen/außen, zweiflügelig, Schiebetür; Türprüfung folgt dem Aufschlag (B5).
4. PDF-Export: Grundriss und Ansichten als Blattsatz, Papierformat A4–A0, fester Maßstab wählbar, Plankopf mit Plannummer, Index, Logo (D3, B9, B10).
5. Hersteller, Typ, Artikelnummer, Preis als Felder am Gerät, in Liste/CSV (D1, B14).
6. Autosave/Wiederherstellung über einen Rust-Befehl (B8/R3).
7. Messwerkzeug, Ausrichten/Verteilen, Kontextmenü, Onboarding mit Kürzel-Übersicht (O1, O3, O6, O7).
8. Release-Notes v0.1.0/v0.2.0, Website-Seite mit Download und SmartScreen/Gatekeeper-Anleitung, Projektvorlagen (B12, B13, X1, D10).

### 0.3 – „Installationsplan und Angebot“
1. Erweitertes Anschlussmodell: Strom A/Absicherung, Anschlussgrößen, Zuluft, Kälte, enthärtetes Wasser, Anschlusspunkte mit Lage und Höhe (B4).
2. Installationsplan je Gewerk mit Symbolen, Bemaßung ab Wand/FFB und Höhentabelle; Anschlüsse auch in 3D (P1, G4).
3. Gewerke-Layer in Plan, PDF und DXF; DXF mit Blöcken und Attributen, R2000 (P2, D5, B7).
4. Kalkulation: Preise, Rabatt, Montage, Summen; Angebot als PDF und Geräteliste als Excel (P7, D4).
5. Prüfung Teil 2: Gangbreiten, Bewegungsflächen, Haubenüberdeckung, Wasser auf der Insel ohne Bodenanschluss, Handwaschbecken (P4).
6. Bereiche mit m² und Flusspfeile rein/unrein mit Legende (P5, P6).
7. Präsentationsmodus mit gespeicherten Kameraansichten (Z1).
8. Unterlage (PNG/JPG) importieren, skalieren, abpausen (P10).

### 0.4 – „Daten und Zusammenarbeit“
1. Offenes Katalogformat (JSON) und Import eigener/Hersteller-Kataloge aus einem Ordner (D2, R4).
2. Herstellermodelle als GLB für 3D und Katalogvorschau (G6).
3. Varianten in einer Datei und Revisionen mit Änderungsliste (P8, Z3).
4. Kommentare/Markierungen im Plan mit Status (Z2).
5. Wärmeabgabe je Gerät und Abluft-Richtwert als Hilfe für den Lüftungsplaner (P3).
6. Ansichten je Wand statt je Himmelsrichtung, schräge Wände (B6).
7. Gruppen und Sperren (O4); Befehlspalette (O2), falls nicht schon in 0.2.
8. IFC-Export (Prototyp) mit Property Sets für Anschlüsse (D7).

Offene Entscheidungen für dich: Store/winget (X2, X3) vs. „kein Store-Build“; Pro-Paket ja/nein
und wie es sich zur MIT-Lizenz verhält; PDF in TS oder Rust (Prototyp beider in 0.2 entscheiden).

---

## Quellen

1. Stellenanzeige Mensaküchenplaner (gpe projekt) – https://www.remotely.de/job/gpe-projekt-mensakuchenplaner-mwd-grosskuchen-versorgungskuchen
2. Stellenprofil Innenarchitekt Großküchen (HAWK) – https://www.hawk.de/sites/default/files/2025-08/innen-architekt_28.08.2025.pdf
3. Stellenanzeige Großküchenplanung, Installationspläne (karriere.at) – https://www.karriere.at/jobs/10019696
4. Revalize: KCL-Übernahme, FAQ – https://revalizesoftware.com/?p=16889 ; https://www.verdictfoodservice.com/news/revalize-buys-software-kcl
5. KCL – https://www.kclcad.com/?p=1086
6. ProKitchen Preise – https://www.prokitchensoftware.com/pricing
7. pCon/OFML, KBS-Katalog – https://catalogs.pcon-solutions.com/welcome/o-17977501012f45efa34dbd6a1ecb1046 ; https://iba.online/en/knowledge/space-planning/ofml/ofml-overview/
8. Graphisoft-Forum: Küchenplanung mit Archicad – https://community.graphisoft.com/t5/Modellierung/Professionelle-K%C3%BCchenplanung-mit-Archicad/m-p/459772
9. BGN-Stellungnahme Lüftung – https://bgn-branchenwissen.de/praxishilfen-von-a-z/klima-lueftung/BGN_Stellungnahme_Lueftung.pdf
10. DIN EN 16282-1/-2/-3 (DIN Media) – https://www.dinmedia.de/de/norm/din-en-16282-1/264926982 ; https://www.dinmedia.de/de/norm/din-en-16282-2/281081108 ; https://www.dinmedia.de/de/norm/din-en-16282-3/339505426
11. Linear: Berechnungsverfahren VDI 2052-1 – https://www.linear.eu/en/services/knowledge-base-revit/v26/analyzing-buildings/ventilation/about-air-volume-calculation-for-residential-and-non-residential-buildings/about-the-calculation-method-vdi-2052-1-kitchens-04-2017/
12. DIN 18865 Teile (DIN Media) – https://www.dinmedia.de/de/norm/din-18865-2/303661187 ; https://www.dinmedia.de/de/norm/din-18865-9/343247939
13. KOMNET zu Bewegungsflächen in Küchen (DGUV 110-002/110-003) – https://www.komnet.nrw.de/_sitetools/dialog/13758 ; https://www.komnet.nrw.de/_sitetools/dialog/11897
14. Paduch, Hygiene in Großküchen – https://www.ba-sachsen.de/fileadmin/user_upload/Paduch_Artikel_Grosskuechen.pdf ; Hygiene-Leitlinie Großküchen – https://wko.at/ktn/handel/maschinen-technologie/hygiene-leitlinie-fuer-grosskuechen.pdf
15. Gastronorm – https://en.wikipedia.org/wiki/Gastronorm
16. Rational-Fallstudie (Gleichzeitigkeit ~0,32) – https://www.rational-online.com/de_ch/cmp/axa-case-study/article-kramer/
17. HKI CERT Großküchentechnik – https://www.grosskuechen.cert.hki-online.de/pdf/HKI%20CERT%20NEU%202026%20DEUTSCH/Anhang%20W.pdf
18. FCSI Revit-Standards – https://www.fcsi.org/?p=226 ; https://fesmag.com/topics/the-latest-news/12851-building-information-modeling-foodservice-equipment-standards-updated-for-2015
19. GS1 Foodservice/GDSN, ETIM – https://www.gs1.org/foodservice ; https://etim-international.com/
20. Beispiel Hersteller-BIM-Downloads (Delabie, BIMobject) – https://www.delabie.com/our-services/download/bim-files/bim-files-can-be-downloaded-for-free-from
