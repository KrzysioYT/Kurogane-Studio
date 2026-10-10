# Kurogane Studio

**Autorski edytor 3D na Windows** — projekt prywatny właściciela `KrzysioYT`. Kurogane Studio **nie** jest powiązane z FiveForge, Rockstar Games ani Cfx.re.

## Status (v0.1.0 / MVP)

Działa: desktopowy interfejs Tauri 2 / React, obracany podgląd 3D Three.js, scena demonstracyjna, import **GLB**, **OBJ** i samowystarczalnych **GLTF** (z zasobami wbudowanymi), wybór elementów modelu, przesuwanie/obracanie/skalowanie, drzewo elementów, edycja materiałów (kolor, metaliczność, szorstkość), widoczność elementów oraz eksport **GLB** przez natywne okno zapisu Windows.

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
3. Po prawej zmień pozycję/obrót/skalę i materiał wybranej części, albo ukryj ją w hierarchii.
4. Użyj **Eksportuj GLB**. Zapisuje wyłącznie edytowany model, bez pomocy wizualnych sceny.

Import GLTF wymagający zewnętrznych tekstur/plików `.bin` nie jest jeszcze obsługiwany — użyj `.glb`. Import OBJ bez MTL zachowuje tylko geometrię i generowane materiały. Wykorzystuj wyłącznie modele i tekstury, do których masz prawa.

## Architektura

- Tauri 2 + Rust: natywna powłoka Windows i bezpieczny dialog zapisu.
- React + TypeScript + Vite: UI i katalog narzędzi.
- Three.js: scena, selekcja, transformacje, import/eksport GLB, import OBJ.
- Wszystkie konwersje GTA pozostają oddzielnym przyszłym modułem, bez fałszywego deklarowania kompatybilności.

Kodu FiveForge nie kopiowano. Nazwy funkcji w roadmapie są wyłącznie odniesieniem do zakresu planowanego produktu.
