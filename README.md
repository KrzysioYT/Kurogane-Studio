## Existing ZIP add-on project editor (v0.4 alpha)

Wybierz **FiveM Add-on → Otwórz ZIP / pliki** lub przeciągnij paczkę resource. Kurogane zachowuje dodatki, skrypty i manifest, pozwala edytować pliki tekstowe, zmieniać handling i podmieniać zasoby, a następnie generuje nowy ZIP bez modyfikowania oryginału. Zobacz [instrukcję](docs/ZIP_ADDON_EDITOR.md).

# RPF → FiveM (v0.3 Alpha)

Kurogane Studio ma teraz natywny importer Rockstar RPF7 dla **niezaszyfrowanych archiwów modów**. W zakładce `FiveM Add-on` użyj przycisku **Otwórz RPF7**, wybierz `.rpf`, sprawdź automatyczne dane pojazdu, uzupełnij handling i kliknij **Eksportuj addon ZIP**.

Proces odbywa się lokalnie w Windows, na bibliotece Rust `rpf-archive` (Unlicense, https://github.com/VIRUXE/rpf-archive-rs); nie wymaga OpenIV ani przesyłania plików na serwer. Importer obsługuje również zagnieżdżone **otwarte** archiwa, zachowuje nagłówki modeli RSC7, kopiuje modele GTA do `stream/` i znane metadane do `data/`. Generowanie paczki FiveM działa przez istniejący walidator resource.

**Ograniczenia:** archiwa zaszyfrowane AES/NG są świadomie odrzucane. Na razie jeden samochód na resource; wielopojazdowe DLC, zamiana modeli *replace* na add-on, audio DLC oraz nieznane pliki meta wymagają osobnej implementacji. `.rpf` nie oznacza podglądu geometrii `.yft` w 3D. Własne `vehicles.meta` i `handling.meta` najlepiej zachować, gdyż uniwersalne szablony nie zapewniają dopasowania do każdej modyfikacji.

Limity importera: archiwum do 256 MiB, po rozpakowaniu do 160 MiB, pojedynczy plik do 100 MiB, 500 dopuszczonych plików. RPF nie jest nigdy wykonywany jako kod.

**Test:** `npm test`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `npm run tauri build`. Zawsze zweryfikuj spawn w FiveM.

---

# Kurogane Studio

**Autorski edytor 3D na Windows** — projekt prywatny właściciela `KrzysioYT`. Kurogane Studio **nie** jest powiązane z FiveForge, Rockstar Games ani Cfx.re.

## Status (v0.1.0 / MVP)

Działa: desktopowy interfejs Tauri 2 / React, obracany podgląd 3D Three.js, scena demonstracyjna, import **GLB**, **OBJ** i samowystarczalnych **GLTF** (z zasobami wbudowanymi), wybór elementów modelu, przesuwanie/obracanie/skalowanie, drzewo elementów, edycja materiałów (kolor, metaliczność, szorstkość) oraz podmiana tekstury PNG/JPG/WebP dla mesha z UV, widoczność elementów oraz eksport **GLB** przez natywne okno zapisu Windows.

**Nie działa jeszcze**: import/eksport GTA V **YFT/YTD**, kolizje, LOD-y, kompletne pojazdy do FiveM, automatyczne rigowanie, narzędzia AI. Eksport GLB **nie tworzy automatycznie pojazdu GTA V**. 29 zaplanowanych narzędzi jest opisanych w `docs/ROADMAP.md`, ale pozostałe nie są oznaczane jako zaimplementowane.

## Uruchamianie na Windows

Wymagane: Node.js LTS, Rust toolchain (MSVC), Microsoft C++ Build Tools, WebView2 (zwykle dostępny w Windows 11).

```powershell
git clone https://github.com/KrzysioYT/Kurogane-Studio.git
cd Kurogane-Studio
npm install
npm run tauri dev
```

Build instalatora: `npm run tauri build`. Wydanie NSIS: `src-tauri/target/release/bundle/nsis/`. Workflow `Windows build` tworzy również artefakt na GitHub Actions.

Szybki test samego UI: `npm run dev` (w przeglądarce zapis GLB używa pobrania zamiast natywnego okna dialogowego). Weryfikacja TS/Vite: `npm run build`.

## Obsługa

1. Kliknij **Auto demonstracyjne**, by załadować przykładowy model z geometrii, albo **Importuj model** i wybierz `.glb`, `.obj` lub samowystarczalny `.gltf`.
2. Kliknij siatkę w widoku lub pozycję w **Hierarchii**. `W` przesuwanie, `E` obrót, `R` skala; `F` dopasowanie kamery.
3. Po prawej zmień pozycję/obrót/skalę i materiał wybranej części, wczytaj teksturę PNG/JPG/WebP (wymaga UV), albo ukryj część w hierarchii.
4. Użyj **Eksportuj GLB**. Zapisuje wyłącznie edytowany model, bez pomocy wizualnych sceny.

Import GLTF wymagający zewnętrznych tekstur/plików `.bin` nie jest jeszcze obsługiwany — użyj `.glb`. Import OBJ bez MTL zachowuje tylko geometrię i generowane materiały. Wykorzystuj wyłącznie modele i tekstury, do których masz prawa.

## Architektura

- Tauri 2 + Rust: natywna powłoka Windows i bezpieczny dialog zapisu.
- React + TypeScript + Vite: UI i katalog narzędzi.
- Three.js: scena, selekcja, transformacje, import/eksport GLB, import OBJ.
- Wszystkie konwersje GTA pozostają oddzielnym przyszłym modułem, bez fałszywego deklarowania kompatybilności.

Kodu FiveForge nie kopiowano. Nazwy funkcji w roadmapie są wyłącznie odniesieniem do zakresu planowanego produktu.


## FiveM Vehicle Workshop (v0.2 alpha)

Kliknij **FiveM Add-on** w górnym pasku (obok przycisków edytora 3D). Importuj istniejący resource ZIP albo zaznacz pliki GTA `.yft`, `_hi.yft`, `.ytd` i opcjonalnie `.meta`. Program:

1. Rozpoznaje pliki stream i obsługiwane metadane z ZIP (w tym podfoldery); odrzuca obce skrypty i ścieżki wychodzące poza archiwum.
2. Próbuje wypełnić spawn, TXD, handling, audio i parametry auta z importowanego zestawu.
3. Pozwala zmienić model/spawn, nazwy, producenta, klasę pojazdu, koła, tablice, audio, layout, flagi i 18 podstawowych parametrów handlingu.
4. W trybie zachowania oryginału podmienia wybrane pola istniejącego `vehicles.meta`, `handling.meta` i `carvariations.meta` bez usuwania pozostałych właściwości. Własne `carcols.meta` (modkity/syreny) i `vehiclelayouts.meta` zachowuje bez zmian.
5. Jeśli brakuje metadanych, tworzy bazowe `vehicles.meta`, `handling.meta`, `carvariations.meta`, dołącza poprawny `fxmanifest.lua`, opcjonalny `vehicle_names.lua`, README i linię `ensure`.
6. Eksportuje ZIP z folderem resource, zawierającym oryginalne pliki binarne GTA oraz wygenerowane/zmienione metadata. Brak pliku `[spawn].yft` **blokuje eksport**.

Instalacja resource: rozpakuj ZIP do `server-data/resources/[cars]/`, następnie `ensure nazwa_resource` w `server.cfg`. Testuj na własnym serwerze, mając prawo do wykorzystywanego modelu.

### Ograniczenia

- Import `.yft/.ytd` jest importem **binarnych plików do paczki**, NIE wyświetleniem ich geometrii w edytorze 3D i NIE konwersją do innych formatów.
- Warsztat obsługuje na ten etap **pojedynczy samochód osobowy**. Modele specjalne (heli, łodzie, pociągi, motocykle), zestawy wielopojazdowe oraz ELS wymagają osobnych modułów.
- Wygenerowane metadata są ustawieniami startowymi, nie gwarantują pełnej kompatybilności z dowolnym modelem. Importowanie istniejącego poprawnego zestawu metadata zapewnia lepszy rezultat niż automatyczny szablon.
- Program nie potrafi tworzyć kolizji, kości/riggingu, tuningu, świateł ELS, LOD-ów i fizycznych komponentów 3D samym manifestem. Weryfikacja uruchomienia addonu, spawnu i jazdy musi odbyć się w FiveM.
- Granica wejściowa: 600 plików w ZIP, 150 MiB na pojedynczy plik, 256 MiB danych, 256 MiB zapisany ZIP. Program nie wykonuje kodu z importowanego ZIP.
- W plikach YAML/JSX/Tauri nie ma telemetrii ani transferu modeli na serwer.

Weryfikacja automatyczna: `npm test` oraz `npm run build`. Instalator NSIS buduje workflow GitHub Actions; test w FiveM jest dodatkowym etapem manualnym.

Szczegóły: `docs/FIVEM_ADDON.md`.
