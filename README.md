# Kurogane Studio — v0.16.0 Alpha

Desktopowy edytor zasobów 3D na Windows, projekt `KrzysioYT`. Nie jest powiązany z Rockstar Games ani Cfx.re.

## Co działa

- Import GLB/GLTF/OBJ, dodawanie części do sceny, bryły, transformacje, duplikowanie i hierarchia.
- Modelowanie trójkątów: wybór regionu, wyciąganie, podział, inset pojedynczej ściany, usuwanie i oddzielanie części.
- Edycja punktów z miękkim promieniem i symetrią X, normalne, spawanie, pivoty.
- Materiały i tekstury także per slot, projekcje UV, podgląd i transformacje UV.
- Widoki ortograficzne, snap, lokalne/światowe osie, siatka, skróty i historia sceny.
- Projekty `.kurogane` z ukrytymi obiektami i osadzonymi teksturami; eksport widocznych części do GLB.
- Warsztat FiveM: import istniejącego addonu ZIP, otwartego RPF7, edycja metadanych i eksport paczki.
- Natywne YTD: podgląd i podmiana tekstur. Podgląd YFT i eksperymentalny zapis pozycji istniejących wierzchołków z historią, symetrią i miękkim promieniem.
- Naklejki i oznaczenia tekstowe 3D, narzędzie Model Doctor do diagnostyki siatek oraz automatyczne rozmieszczanie wysp UV.
- Kliknięcie modelu YFT w widoku 3D w celu naniesienia logo na wskazaną teksturę YTD, z kopiami zapasowymi i kontrolami bezpieczeństwa.

**Nowa topologia zapisuje się w projekcie/GLB, nie w YFT.** Nadal brakuje pełnego eksportera YFT, rigowania, kolizji, aktualizacji bounds i generowania LOD. Oznaczenia części/LOD są metadanymi przygotowawczymi. Nie jest to jeszcze pełne modelowanie gotowych samochodów FiveM ani wydanie 1.0.

Instrukcje:

- [Modelowanie, UV, historia i projekty 0.11](docs/FACE_MODELER.md)
- [Istniejące ZIP addony](docs/ZIP_ADDON_EDITOR.md)
- [Generator FiveM](docs/FIVEM_ADDON.md)
- [Texture Studio](docs/TEXTURE_STUDIO.md)
- [Eksperymentalny zapis YFT i ograniczenia](docs/YFT_EXPERIMENTAL_ROUNDTRIP.md)
- [Shader → tekstury](docs/SHADER_TEXTURE_MAPPING.md)
- [Kliknięcie YFT → malowanie YTD](docs/YFT_TO_YTD_PAINT.md)
- [Model Doctor](docs/MODEL_DOCTOR.md)
- [Wyspy UV](docs/UV_ATLAS.md)
- [Oznaczenia 3D](docs/TEXT_MARKINGS_3D.md)
- [Roadmapa modułów](docs/ROADMAP.md)

## Uruchomienie i build Windows

Node.js 22+, Rust MSVC, Microsoft C++ Build Tools i WebView2.

```powershell
git clone https://github.com/KrzysioYT/Kurogane-Studio.git
cd Kurogane-Studio
npm ci
npm test
npm run build
npm run tauri dev
```

Instalator: `npm run tauri build`. Testy natywne: `cargo test --manifest-path src-tauri/Cargo.toml --lib`. Workflow Windows uruchamia się dla `main` i PR kierowanych do `main`, tworząc artefakt `kurogane-studio-windows-nsis` po pomyślnych testach. Cały stos rozwojowy v0.1–v0.16 scalono do `main` w PR #24.

## Ograniczenia formatów

RPF7: otwarte archiwa modów, również zagnieżdżone; brak AES/NG/escrow. Jeden samochód na resource. YFT: RSC7, zapis istniejących pozycji Float3 bez przebudowy fragmentu, kości i kolizji. RSC8/Gen9 nie jest obsługiwane. GLTF powinien mieć osadzone zasoby; OBJ nie wczytuje zewnętrznego MTL.

Biblioteki Rust: `rpf-archive` i `rage-formats`. Importowane skrypty resource nie są wykonywane przez aplikację. Testy FiveM odłożono; status kompilacji i testów jest opisany oddzielnie od zgodności modelu z grą.
