# Kurogane Studio — Retexture & Logo Studio v0.5

## Faktyczna obsługa YTD
To nie jest podmiana pliku PNG w resource. Nowy moduł Rust korzysta z biblioteki `rage-formats 0.5` (Unlicense), by czytać słowniki tekstur GTA V **RSC7 YTD**, dekodować ich tekstury do PNG, kodować edytowane obrazy z mipmapami i ponownie zapisywać cały słownik `.ytd`. Po zapisie program **ponownie parsuje YTD** i sprawdza, czy liczba tekstur i modyfikowany wpis zostały zachowane.

1. Otwórz **FiveM Add-on** i załaduj ZIP z prawidłowym `stream/model.ytd`.
2. Przejdź do **03 · Retexture / Loga**.
3. Wybierz `.ytd`, a potem teksturę ze słownika. Nazwy, wymiary, format kompresji i ilość mipmap są wykrywane automatycznie.
4. Maluj **pędzlem**, wymazuj, dodaj **napis** albo załaduj własne logo PNG/JPEG/WebP i kliknij na teksturze, aby je umieścić.
5. Używaj **Cofnij/Ponów**, wyboru koloru, wielkości narzędzia i skalowania obrazu.
6. Kliknij **Zapisz teksturę w YTD**, potem **Eksportuj addon ZIP** z głównego warsztatu. Oryginalny ZIP pozostaje bez zmian.

## Gdzie skończyliśmy, a gdzie nie
- **Działa w kodzie**: import YTD, podgląd i malowanie 2D, PNG → kompresja BC1/BC3/BC4/BC5/BC7 lub nieskompresowane RGBA, zachowanie pozostałych tekstur w słowniku, natywna serializacja RSC7 i test roundtrip. Czy cały workflow działa na Twoim modelu, potwierdzi dopiero test rzeczywistego auta w FiveM.
- **Jeszcze nie**: generowanie/modelowanie geometrii YFT, UV mapping w przestrzeni 3D na karoserii, kości, kolizje, LOD-y, montaż tuningu. Edytor 2D może nanieść logo w niewłaściwe miejsce na modelu, jeśli nie znasz układu jego UV. Planowana jest powiązana wizualizacja YFT.
- Wiele importowanych binarnych formatów GTA jest objętych prawami autorów; używaj tylko modeli, do których masz uprawnienia.

## Ograniczenia
- Import RSC7/YTD do 128 MiB i do 1024 tekstur.
- Pojedyncza tekstura do 8192 px w obu wymiarach, PNG do 32 MiB. Zapis zachowuje rozmiar oryginalnej tekstury; nowy PNG musi mieć identyczną szerokość i wysokość.
- Zapis może zmienić format kompresji oryginalnej tekstury z DXT3 na BC3/DXT5, a nieobsługiwane formaty na RGBA8. W efekcie rozmiar YTD może się zmienić; sprawdź efekt w FiveM.
- Operacje na dużych obrazach są kosztowne pamięciowo, dlatego liczba stanów cofania spada przy dużych teksturach.
- Zachowujemy dane projektu w pamięci; pliki w ZIP nie są wykonywane.
- Biblioteka [rage-formats](https://github.com/VIRUXE/rage-formats) jest objęta licencją Unlicense i jest zależnością programu.

## Testy
- `npm test` – testy generatora ZIP.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` – testy YTD roundtrip i rozmiarów oraz RPF7.
- `npm run build` – TypeScript i Vite.
- `npm run tauri build` – instalator Windows.
