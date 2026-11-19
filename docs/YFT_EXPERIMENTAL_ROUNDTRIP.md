# Kurogane Studio v0.10 — eksperymentalna edycja geometrii YFT

## Co jest zaimplementowane

**To jest rzeczywista operacja na oryginalnym modelu RSC7 YFT**, a nie zapis GLB pod inną nazwą. Program odczytuje z YFT istniejące bufory wierzchołków typu Float3, pozwala przesunąć pojedyncze punkty w widoku Three.js, a następnie nadpisuje **wyłącznie 12 bajtów współrzędnych** wskazanego punktu. Dane są ponownie pakowane do RSC7 z oryginalnym nagłówkiem, flagami stron i układem sekcji.

Program świadomie nie potrafi na tym etapie dobudować nowych meshów do YFT, zmienić topologii, kości, drzwi, kół ani kolizji. Nie zastępuje pełnego narzędzia do eksportu GTA.

## Instrukcja testowa
1. Załaduj kopię poprawnego, niezaszyfrowanego ZIP-a samochodu w zakładce **FiveM Add-on**. Nie używaj plików z produkcyjnego serwera bez wykonania kopii zapasowej.
2. W zakładce **Podgląd YFT 3D** wybierz oryginalny plik YFT.
3. Zaznacz **Przesuwaj wierzchołki YFT**, wskaż punkt na siatce i przesuń go manipulatorem.
4. Kliknij **Zapisz YFT (eksperymentalne)**. Jeśli bufor jest nieobsługiwany lub walidacja nie przejdzie, zapis zostanie odrzucony, a poprzedni YFT pozostanie w projekcie.
5. Wyeksportuj ZIP i uruchom go **na serwerze testowym FiveM**. Sprawdź poprawność karoserii, culling, drzwi, kół, fizyki, tekstur, LOD, uszkodzeń i zachowania przy oddalaniu kamery.
6. W razie problemów kliknij **Przywróć oryginał** w zakładce modelu, a następnie wyeksportuj ZIP ponownie.

## Ograniczenia i weryfikacja
- Tylko istniejące punkty współrzędnych Float3, maksymalnie 20 000 zmian i maksymalny skok 4 jednostki GTA względem pierwotnej geometrii.
- Obsługa wyłącznie RSC7; escrow FXAP, RSC8 / Gen9, nieobsługiwane/kwantyzowane bufory są odrzucane.
- Parser porównuje wszystkie rozpoznane pozycje przed i po serializacji. Po ponownym rozpakowaniu sekcje RSC7 muszą być **identyczne** z planowanymi sekcjami; nagłówek musi zachować 16 oryginalnych bajtów.
- Wewnątrz sekcji binarnych nie wolno zmieniać żadnego bajtu poza dokładnie wskazanymi współrzędnymi. Nakładające się poprawki są odrzucane.
- Ograniczenie pliku wejściowego do 160 MiB; rozpakowanych sekcji do 512 MiB.
- Oryginalny importowany ZIP nie jest nadpisywany; pierwsza wersja pliku YFT w projekcie jest dostępna przez **Przywróć oryginał**.
- Sprawdzenie parserem RSC7 i testy Rust **nie dowodzą**, że GTA załaduje zmodyfikowany model, ani że culling, szkielet i kolizje pozostaną poprawne w grze. Bounds nie są tutaj przeliczane.
- Eksport addonu z modyfikowanym YFT wymaga potwierdzenia przeznaczenia do testów.

## Status 1.0
**To nadal v0.10 eksperymentalne, nie 1.0.** Warunkiem wydania jest pełna droga import→modelowanie→zapis YFT→uruchomienie w FiveM dla rzeczywistego samochodu, poprawne kości/LOD/kolizje i akceptacja testów. Pełna lista w [issue #14](https://github.com/KrzysioYT/Kurogane-Studio/issues/14).

Testy automatyczne: `npm test`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `npm run tauri build`.
