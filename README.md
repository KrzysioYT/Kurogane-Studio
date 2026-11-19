# Kurogane Studio — 0.11 alpha

Prywatny desktopowy edytor zasobów 3D na Windows, projekt `KrzysioYT`. Nie jest powiązany z Rockstar Games ani Cfx.re.

## Co działa

- Import GLB/GLTF/OBJ, dodawanie części do sceny, bryły, transformacje, duplikowanie i hierarchia.
- Modelowanie trójkątów: wybór regionu, wyciąganie, podział, inset pojedynczej ściany, usuwanie i oddzielanie części.
- Edycja punktów z miękkim promieniem i symetrią X, normalne, spawanie, pivoty.
- Materiały i tekstury także per slot, projekcje UV, podgląd i transformacje UV.
- Widoki ortograficzne, snap, lokalne/światowe osie, siatka, skróty i historia sceny.
- Projekty `.kurogane` z ukrytymi obiektami i osadzonymi teksturami; eksport widocznych części do GLB.
- Warsztat FiveM: import istniejącego addonu ZIP, otwartego RPF7, edycja metadanych i eksport paczki.
- Natywne YTD: podgląd i podmiana tekstur. Podgląd YFT i eksperymentalny zapis pozycji istniejących wierzchołków z historią, symetrią i miękkim promieniem.

**Nowa topologia zapisuje się w projekcie/GLB, nie w YFT.** Nadal brakuje pełnego eksportera YFT, rigowania, kolizji, aktualizacji bounds i generowania LOD. Oznaczenia części/LOD są metadanymi przygotowawczymi. Nie jest to jeszcze pełne modelowanie gotowych samochodów FiveM ani wydanie 1.0.

Instrukcje:

- [Modelowanie, UV, historia i projekty 0.11](docs/FACE_MODELER.md)
- [Istniejące ZIP addony](docs/ZIP_ADDON_EDITOR.md)
- [Generator FiveM](docs/FIVEM_ADDON.md)
- [Texture Studio](docs/TEXTURE_STUDIO.md)
- [Eksperymentalny zapis YFT i ograniczenia](docs/YFT_EXPERIMENTAL_ROUNDTRIP.md)
- [Shader → tekstury](docs/SHADER_TEXTURE_MAPPING.md)
- [Roadmapa modułów](docs/ROADMAP.md)

## Uruchomienie i build Windows

Node.js 22+, Rust MSVC, Microsoft C++ Build Tools i WebView2.

```powershell
git clone --branch feat/face-topology-modeler https://github.com/KrzysioYT/Kurogane-Studio.git
cd Kurogane-Studio
npm ci
npm test
npm run build
npm run tauri dev
```

Instalator: `npm run tauri build`. Testy natywne: `cargo test --manifest-path src-tauri/Cargo.toml --lib`. Workflow Windows tworzy artefakt `kurogane-studio-windows-nsis` dla gałęzi rozwoju. Kod jest w PR #18, bez automatycznego scalenia do main.

## Ograniczenia formatów

RPF7: otwarte archiwa modów, również zagnieżdżone; brak AES/NG/escrow. Jeden samochód na resource. YFT: RSC7, zapis istniejących pozycji Float3 bez przebudowy fragmentu, kości i kolizji. RSC8/Gen9 nie jest obsługiwane. GLTF powinien mieć osadzone zasoby; OBJ nie wczytuje zewnętrznego MTL.

Biblioteki Rust: `rpf-archive` i `rage-formats`. Importowane skrypty resource nie są wykonywane przez aplikację. Testy FiveM odłożono; status kompilacji i testów jest opisany oddzielnie od zgodności modelu z grą.
