# Kurogane Studio — YFT Vehicle Inspector v0.6

Kurogane Studio może teraz **odczytać prawdziwą geometrię** pojazdów GTA V (YFT) bez otwierania Blendera. Biblioteka Rust `rage-formats 0.5` dostarcza parsery RSC7 YFT i jego drawable/LOD/geometrii, a Three.js pokazuje wynik w obracanym podglądzie 3D.

## Jak używać

1. Otwórz **FiveM Add-on** w Kurogane Studio i zaimportuj resource ZIP / .rpf / pliki pojazdu GTA.
2. Przejdź do **04 · Podgląd YFT 3D**.
3. Wybierz `stream/spawn.yft` i poczekaj na odczyt meshów.
4. Obracaj model i sprawdź siatki i liczbę trójkątów.
5. Opcjonalnie wyeksportuj **GLB** z samej geometrii, by otworzyć go w edytorze 3D.

**Uwaga:** GLB zawiera tylko odtworzone meshe/UV/normalne ze wskazanego LOD. Nie przenosi właściwego układu kości, flag GTA, kolizji ani całej struktury fragmentu YFT. Nie nadaje się do bezpośredniego podmienienia YFT w FiveM.

## Uczciwy status do v1.0

| Obszar | Status |
|---|---|
| Import ZIP addonu FiveM i zachowanie plików | v0.4 (zaimplementowano) |
| Edycja handling/vehicles META | v0.4 (zaimplementowano) |
| Natywny odczyt, malowanie, dodawanie logo i zapis YTD | v0.5 (testy CI, potem test w FiveM) |
| Natywny odczyt siatki YFT i preview Three.js | v0.6 (testy CI, potem test na prawdziwym YFT) |
| Pełny edytor geometrii, kości, drzwi i kół | **Niezaimplementowane** |
| Natywny eksport zmodyfikowanego modelu do GTA YFT | **Niezaimplementowany** |
| LOD, skeleton, collisions, vehicle fragments export roundtrip | **Niezaimplementowane** |
| Pełny test spawn/jazdy auta w FiveM po edycji YFT | **Nieprzeprowadzony** |

**Nie uznajemy produktu za v1.0**, zanim nie zostanie zaimplementowany i przetestowany pełny roundtrip YFT → edycja → YFT na rzeczywistym pojeździe.

Ten moduł używa otwartoźródłowego `rage-formats` na licencji Unlicense (https://github.com/VIRUXE/rage-formats).

## Test

`npm test`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `npm run tauri build`. Test importu prawdziwego pojazdu w FiveM na Windows jest oddzielny od testów sztucznych danych.
