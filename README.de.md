<p align="center">
  <img src="public/favicon.png" width="108" height="108" alt="Mirato Logo" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" />
</p>

<h1 align="center">Mirato</h1>

<p align="center">
  <strong>Präsentationsstudio der nächsten Generation: Bibelstellen-Projektion, Gemeindeliederbücher, Vektor-Canvas-Editor und kabelloser Bühnen-Prompter für Gemeinden und Medienteams.</strong><br>
  <em>(Zuvor bekannt als Ekklesienter)</em>
</p>

<p align="center">
  <strong>Sprache / Language / Язык:</strong><br>
  <a href="README.md">English</a> •
  <a href="README.ru.md">Русский</a> •
  <a href="README.de.md"><strong>Deutsch</strong></a>
</p>

<p align="center">
  <a href="https://github.com/borissmiyan/mirato/releases/latest"><img src="https://img.shields.io/badge/Release-v2.3.0-amber.svg?style=flat-square&color=f59e0b" alt="Neuestes Release" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Plattformen-macOS%20|%20Windows%20|%20Linux-blue.svg?style=flat-square" alt="Plattformen" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Architektur-Apple%20Silicon%20|%20Intel%20|%20x64-stone.svg?style=flat-square" alt="Architektur" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square" alt="React 19" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Lizenz-MIT-emerald.svg?style=flat-square" alt="Lizenz" /></a>
  <a href="https://discord.gg/mirato"><img src="https://img.shields.io/badge/Discord-Community-5865F2.svg?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
</p>

---

## 🌟 Über Mirato

**Mirato** wurde mit einem klaren Ziel entwickelt: Gemeinden und Lobpreisteams ein zuverlässiges, blitzschnelles und ästhetisches Präsentationswerkzeug an die Hand zu geben, das technische Pannen während des Gottesdienstes ausschließt.

Die Software vereint professionelle Leistungsmerkmale teurer Broadcast-Systeme (wie ProPresenter) mit der intuitiven Einfachheit moderner Vektorwerkzeuge – und arbeitet während des Gottesdienstes völlig unabhängig von Cloud-Diensten.

> [!TIP]
> **Mirato arbeitet 100% offline.** Bibelübersetzungen, Liederbücher, Medien-Hintergründe und Präsentationen werden lokal auf Ihrem Rechner in IndexedDB gespeichert. Die Software läuft absolut stabil, selbst wenn die Internetverbindung im Saal komplett ausfällt.

---

## ⚡ Hauptmerkmale

### 📖 Blitzschnelle Bibelstellensuche (unter 5 ms)
- **Intelligenter Fuzzy-Parser:** Geben Sie `Joh 3 16`, `Röm 8:28` oder `Ps 23` ein – der Vers erscheint sofort in der Vorschau.
- **Parallele Übersetzungen:** Zwei Übersetzungen nebeneinander anzeigen (z. B. Luther + Elberfelder oder Schlachter + Englisch ESV).
- **Automatischer Schriftgrößen-Abgleich (Auto-Fit):** Lange Bibelpassagen berechnen Schriftgröße und Zeilenabstand automatisch, sodass kein Wort abgeschnitten wird.

### 📱 Mobiler Web-Remote Controller
- **Keine App-Installation nötig:** Scannen Sie einfach einen QR-Code auf jedem Smartphone oder Tablet im lokalen WLAN.
- **Foliensteuerung und Bibel-Suche mobil:** Moderatoren oder Techniker können Folien wechseln, eine Live-Vorschau sehen und Bibelstellen direkt vom Smartphone aus auf die Leinwand projizieren.
- **Direkte Live-Overlays:** Sofortiges Abdunkeln (**Blackout** `B`), Weißblende (**Whiteout** `W`) oder Gemeindelogo (**Logo** `L`) mit nur einem Fingertipp.
- **PIN-Schutz:** Einstellbare PIN-Authentifizierung schützt die Steuerung vor unbefugtem Zugriff.

### 🎵 Gemeindeliederbücher & Gesangsbücher
- **Integrierte Liederbuch-Datenbank:** Schnelle Suche nach Liednummer, Titel oder Textfragment.
- **Strukturierte Strophen:** Automatische Einteilung in Strophen, Refrains und Bridges mit direkter Folienanwahl per Klick.
- **Gemeindegerechte Themen:** Vorlagen und Folienstile, die speziell für Lobpreislieder entworfen wurden.

### 📐 Vektor-Canvas & Foliendesign
- **Präzise Canvas-Engine:** Freies Platzieren von Textblöcken, Formen (Rechtecke, Kreise, Linien), Bildern, Videos und Vektorkonturen mit der Zeichenfeder.
- **Smart Guides & Magnetisches Einrasten:** Intelligente Hilfslinien zur Ausrichtung an der Folienmitte und an benachbarten Elementen.
- **Seitenverhältnis-Portal:** Umschalten des Folienformats (16:9, 16:10, 4:3, 9:16) über ein schwebendes Overlay über allen Bedienfeldern.

### 🖥️ Unabhängiges Multi-Display & Moderator-Workflow
- **Separater Projektor-Prozess:** Das Ausgabefenster für den Beamer läuft unabhängig – der Mauszeiger wird niemals gefangen, sodass während der Präsentation weitergearbeitet werden kann.
- **Live-Bearbeitung im laufenden Betrieb:** Tippfehler korrigieren oder neue Folien erstellen, während der Beamer ohne Unterbrechung weiterläuft.

### 🚨 Direkte Tastaturbefehle für den Livestream (Live Overrides)
- Sofortige Bildschirmschaltung ohne langes Suchen mit der Maus:
  - `B` — **Blackout** (sanftes Abdunkeln der Beamer-Ausgabe zu Schwarz).
  - `W` — **Whiteout** (weißes Vollbild auf dem Beamer).
  - `L` — **Logo** (Einblenden des offiziellen Gemeindelogos).
  - `Esc` — Projektorfenster schließen oder Bearbeitung beenden.

---

## 📊 Vergleich: Mirato vs PowerPoint vs ProPresenter

| Funktion | 👑 Mirato 2.3 | 📄 MS PowerPoint | 🎥 ProPresenter |
| :--- | :---: | :---: | :---: |
| **Multi-Display & Mausfreiheit** | Vollständige Mausfreiheit; Arbeiten während der Präsentation möglich | Blockiert den Mausfokus; Klick außerhalb beendet oft die Schau | Komplexes Multi-Fenster-UI, hohe GPU-Last |
| **Live-Bearbeitung im Gottesdienst** | Nahtlos in Echtzeit ohne Beenden der Projektion | Ohne Unterbrechung der Präsentation unmöglich | Möglich, erfordert jedoch das Öffnen schwerfälliger Editoren |
| **Schnelle Bibelstellensuche** | Unter 5 ms (`Joh 3:16`), parallele Übersetzungen, Auto-Fit | Keine (nur manuelles Kopieren & Einfügen) | Vorhanden, moderne Übersetzungen erfordern jedoch Zusatzmodule |
| **Web Remote Steuerung** | Integriert via QR-Code & WLAN (ohne App, inkl. Bibelsuche & Overlays) | Nur einfache Hardware-Presenter oder PowerPoint-App mit Office-Abo | Erfordert eigene ProRemote-App mit manueller Port-Konfiguration |
| **Bühnenanzeige (StageView)** | Integrierter Bühnen-Monitor (Uhrzeit, Countdown-Timer, Folien) | Nicht vorhanden | Erfordert separates Multi-Screen-Konfigurationsmodul |
| **Gemeindeliederbücher** | Integrierte Liedersammlungen mit Suche nach Liednummer | Nicht vorhanden (jedes Lied muss einzeln formatiert werden) | Nur einfacher Textimport / CCLI SongSelect-Abonnement |
| **Live-Overlays (Blackout/Logo)** | Direkte Tastaturbefehle (`B`, `W`, `L`) | Nur Taste `B` (schwarzer Bildschirm) | Konfigurierbar |
| **Lizenz & Kosten** | **100% Kostenlos & Open Source (MIT)** | Microsoft 365 Abonnement | Ab \$399 + jährliche Update-Gebühren |

---

## ⌨️ Vollständige Tastatur-Kurzbefehle (In-App Cheatsheet)

Hier ist die exakte und vollständige Liste aller in Mirato programmierten Tastenkombinationen (identisch mit dem Einstellungsmenü der App):

### 🎬 Navigation & Wiedergabe (Navigation & Playback)

| Tastenkombination | Aktion | Beschreibung |
| :--- | :--- | :--- |
| `→` / `↓` / `Leertaste` | **Nächste Folie** | Zur nächsten Folie wechseln |
| `←` / `↑` | **Vorherige Folie** | Zur vorherigen Folie zurückkehren |
| `Enter` | **Live schalten (Go Live)** | Ausgewählte Folie auf den Beamer übertragen |
| `Leertaste` | **Medien Pause / Play** | Live-Hintergrundvideo abspielen / pausieren (außerhalb des Canvas) |
| `Esc` | **Projektor schließen** | Beamerfenster schließen oder Bearbeitungsmodus beenden |
| `H` | **Mit Live synchronisieren** | Vorschau an die aktuelle Live-Folie anpassen |
| `⌘F` (Mac) / `Ctrl+F` (Win) | **Suche** | Globales Suchfenster öffnen |
| `⌘H` (Mac) / `Ctrl+H` (Win) | **Verlauf** | Verlauf der letzten Präsentationen öffnen |

### 🚨 Live-Overlays (Live Overrides)

| Tastenkombination | Aktion | Beschreibung |
| :--- | :--- | :--- |
| `B` | **Blackout** | Beamer sanft zu Schwarz abdunkeln |
| `W` | **Whiteout** | Beamer vollflächig weiß schalten |
| `L` | **Logo** | Gemeindelogo auf dem Beamer einblenden |

### 📂 Folien- & Projektverwaltung (Slide Management)

| Tastenkombination | Aktion | Beschreibung |
| :--- | :--- | :--- |
| `⌘S` (Mac) / `Ctrl+S` (Win) | **Speichern** | Aktuellen Ablaufplan oder Präsentation speichern |
| `⌘Z` (Mac) / `Ctrl+Z` (Win) | **Rückgängig (Undo)** | Letzte Aktion zurücknehmen |
| `⌘Shift+Z` / `Ctrl+Y` | **Wiederholen (Redo)** | Zurückgenommene Aktion wiederholen |
| `⌘D` (Mac) / `Ctrl+D` (Win) | **Duplizieren** | Ausgewählte Folie oder Canvas-Element duplizieren |
| `Entf` / `Backspace` | **Löschen** | Ausgewählte Folie oder Element löschen |
| `⌘[` / `⌘]` | **Folien-Reihenfolge** | Folie nach vorne / nach hinten verschieben |

### 🎨 Vektor-Canvas-Editor (Canvas Editor)

| Tastenkombination | Aktion | Beschreibung |
| :--- | :--- | :--- |
| `V` | **Auswahlwerkzeug** | Objekte auswählen und verschieben |
| `H` | **Hand-Werkzeug** | Arbeitsfläche verschieben (Pan) |
| `P` | **Vektor-Zeichenfeder** | Eigene Vektorpfade und Formen zeichnen |
| `T` | **Text einfügen** | Neues Textfeld auf der Folie erstellen |
| `R` | **Rechteck** | Rechteck-Form zeichnen |
| `O` | **Kreis** | Kreis / Ellipse zeichnen |
| `L` | **Linie** | Gerade Linie zeichnen |
| `I` | **Pipette (EyeDropper)** | Farbe direkt von Bildschirmelementen aufnehmen |
| `Leertaste + Drag` | **Canvas verschieben** | Schnelles Verschieben der Arbeitsfläche mit der Maus |
| `↑` `↓` `←` `→` (Pfeiltasten) | **Präzises Verschieben** | Element um 1% verschieben |
| `Shift + Pfeiltasten` | **Schnelles Verschieben** | Element um 5% verschieben |
| `⌘+` / `⌘-` | **Zoom** | Vergrößern / Verkleinern |
| `⌘0` / `Shift+1` | **Zoom zurücksetzen** | Folie optimal in das Fenster einpassen |
| `Shift+2` | **Zoom auf Auswahl** | Auf das ausgewählte Element zoomen |
| `⌘1` | **Zoom 100%** | Tatsächliche Pixelgröße 1:1 anzeigen |
| `⌘C` / `⌘V` | **Kopieren / Einfügen** | Elemente kopieren und einfügen |
| `⌘Alt+C` / `⌘Alt+V` | **Stil übertragen** | Schrift- und Farb-Stile kopieren und einfügen |
| `⌘G` / `⌘Shift+G` | **Gruppieren** | Elemente gruppieren / Gruppierung aufheben |
| `⌘Shift+L` | **Sperren** | Element sperren / entsperren |
| `⌘Shift+H` | **Sichtbarkeit** | Element ausblenden / einblenden |
| `⌘]` / `⌘[` | **Ebenen (Z-Index)** | Ganz nach vorne / ganz nach hinten bringen |
| `Shift+H` / `Shift+V` | **Spiegeln** | Horizontal / vertikal spiegeln |
| `Shift+R` | **Lineale** | Lineale ein- oder ausblenden |
| `Alt / ⌥ (gedrückt halten)` | **Abstände messen** | Pixelabstände zu benachbarten Elementen anzeigen |
| `⌘/` oder `⌘K` | **Befehls-Palette** | Schnellbefehls-Menü des Canvas aufrufen |

### 📖 Bibel-Modus (Scripture Mode)

| Tastenkombination | Aktion | Beschreibung |
| :--- | :--- | :--- |
| `⌘Shift+C` (Mac) / `Ctrl+Shift+C` (Win) | **Vers kopieren** | Aktuellen Bibelvers samt Stellenangabe und Übersetzung kopieren |

---

## 📥 Mirato herunterladen (Version 2.3.0)

Fertige Installationspakete für alle gängigen Betriebssysteme stehen im [v2.3.0 Release](https://github.com/borissmiyan/mirato/releases/tag/v2.3.0) bereit:

| Plattform | Architektur | Paket | Download-Link |
| :--- | :--- | :--- | :--- |
| **macOS** | **Apple Silicon (M1 / M2 / M3 / M4)** | `.dmg` (207 MB) | [Download für Mac (Apple Silicon)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-macOS12+-arm64.dmg) |
| **macOS** | **Intel (x86_64)** | `.dmg` (213 MB) | [Download für Mac (Intel)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-macOS12+-x64.dmg) |
| **Windows** | **64-Bit (x64)** | `.exe` (175 MB) | [Download für Windows 10/11](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-Setup-2.3.0.exe) |
| **Linux** | **64-Bit (x86_64)** | `.AppImage` (211 MB) | [Download AppImage (x86_64)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-x86_64.AppImage) |
| **Linux** | **ARM64 (aarch64)** | `.AppImage` (212 MB) | [Download AppImage (arm64)](https://github.com/borissmiyan/mirato/releases/download/v2.3.0/Mirato-2.3.0-arm64.AppImage) |

---

## 🍎 Wichtiger Hinweis für macOS-Nutzer (`xattr`-Befehl)

Da Mirato ein freies Open-Source-Projekt ohne kostenpflichtiges Apple-Entwicklerzertifikat ($99/Jahr) ist, zeigt **Apple Gatekeeper** beim ersten Start möglicherweise folgende Meldung an:

> *„Mirato ist beschädigt und kann nicht geöffnet werden. Es empfiehlt sich, das Objekt in den Papierkorb zu verschieben.“*

### Entsperren in 10 Sekunden:
1. Ziehen Sie **Mirato.app** aus dem gemounteten DMG-Image in Ihren Ordner **Programme** (`/Applications`).
2. Öffnen Sie das macOS **Terminal** (`Cmd + Leertaste` → *Terminal* eingeben).
3. Fügen Sie folgenden Befehl ein und bestätigen Sie mit Enter:

```bash
xattr -cr /Applications/Mirato.app
```

*(Falls nach Administratorrechten gefragt wird: `sudo xattr -rd com.apple.quarantine /Applications/Mirato.app`)*

4. Starten Sie Mirato erneut. Die Anwendung startet nun sofort und dauerhaft ohne Warnungen!

> [!NOTE]
> Eine Textdatei mit genau diesem Befehl liegt auch direkt im gemounteten DMG-Image bei (`Команда_для_Терминала.txt`).

---

## 🛠️ Technologie-Stack

- **Desktop-Basis:** [Electron](https://www.electronjs.org/) mit Multi-Window-Architektur für Controller und Projektor.
- **Frontend-UI:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS v4](https://tailwindcss.com/).
- **Zustandsverwaltung:** [Jotai](https://jotai.org/) (atomarer UI-Zustand) + [Zustand](https://zustand-demo.pmnd.rs/) (Präsentationslogik).
- **Offline-Datenbank:** [Dexie.js](https://dexie.org/) (IndexedDB) für vollständige Autonomie.
- **Netzwerk & Steuerung:** Integrierter HTTP- und WebSocket-Server für mobile Web-Remote-Synchronisierung.
- **Medien-Engine:** Integriertes [FFmpeg WebAssembly](https://ffmpegwasm.netlify.app/) für Video-Thumbnails und Caching.

---

## 👨‍💻 Quellcode kompilieren

```bash
# 1. Repository klonen
git clone https://github.com/borissmiyan/mirato.git
cd mirato

# 2. Abhängigkeiten installieren
npm install

# 3. Entwicklungsmodus starten
npm run dev

# 4. Automatisierte Tests ausführen (588 Tests)
npm run check:design
npm run check:hygiene
npm run check:esm
npx vitest run

# 5. Production-Pakete bauen
npm run build:mac-modern   # macOS Apple Silicon + Intel DMG
npm run build:win          # Windows Setup Installer
npm run build:linux        # Linux AppImage
```

---

## 🤝 Community & Mitwirken

- 💬 **Discord-Community:** [discord.gg/mirato](https://discord.gg/mirato)
- 🐛 **Fehler melden:** [GitHub Issues](https://github.com/borissmiyan/mirato/issues)
- 💡 **Diskussionen & Ideen:** [GitHub Discussions](https://github.com/borissmiyan/mirato/discussions)

---

<p align="center">
  Entwickelt mit Hingabe und Gebet für Gemeinden weltweit. 🤍<br>
  <strong>Mirato © 2026. Veröffentlicht unter der MIT-Lizenz.</strong>
</p>
