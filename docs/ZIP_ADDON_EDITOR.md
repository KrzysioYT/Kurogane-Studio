# Kurogane Studio — edycja istniejącego addonu FiveM z ZIP (v0.4 alpha)

## Cel

Przeciągnij **jeden ZIP istniejącego resource** do panelu **FiveM Add-on** albo użyj **Otwórz ZIP / pliki**. Program zachowuje modele, tekstury, metadane i dodatkowe pliki zasobu, zamiast usuwać skrypty, manifest, UI i własne ustawienia.

1. Otwórz `.zip` z resource (przykład: `policecar/fxmanifest.lua`, `policecar/stream/`, `policecar/data/`).
2. W zakładce **Pojazd** zmień spawn, autora, audio, klasę lub inne parametry (w razie zmiany spawnu upewnij się, że istnieje model o dokładnie tej nazwie).
3. W zakładce **Handling** ustaw parametry fizyki.
4. W zakładce **Zasoby** wybierz plik `.meta`, `.lua`, `.json`, `.cfg` i inne formaty tekstowe. Edytuj tekst i kliknij **Zapisz w projekcie**. Zmiana metadanych zaktualizuje rozpoznane ustawienia.
5. Możesz też wybrać dowolny plik projektu i użyć **Podmień plik**. Wymagane jest zgodne rozszerzenie; dla YFT/YTD sprawdzany jest nagłówek RSC7/RSC8.
6. W zakładce **Wygenerowane pliki** sprawdź metadane, a następnie użyj **Eksportuj addon ZIP**.

Oryginalny ZIP pozostaje niezmieniony. Nowy ZIP zapisujesz we wskazanym przez siebie miejscu.

### Co zachowujemy

- Foldery i pliki niezarządzane przez generator, m.in. `client/`, `server/`, `html/`, `stream/`, pliki `.lua`, `.js`, `.json`, `.png`, `.ogg` i inne.
- Importowany `fxmanifest.lua` (gdy włączono `Zachowuj istniejące META`) — istniejące skrypty i niestandardowe rejestracje pozostają, standardowe wpisy META są synchronizowane z plikami generowanymi przez Kurogane.
- Dodatkowe `.yft/.ytd` związane z tym samym modelem (możliwy tuning) oraz importowany `carcols.meta`.

### Ograniczenia

- **Nie kopiujemy bezkrytycznie dowolnej paczki**: archiwa z wieloma manifestami są odrzucane; podejrzane ścieżki `../`, pliki wykonywalne, duplikaty i potencjalne ZIP-bomby podlegają kontroli.
- ZIP z samym `dlc.rpf` nie jest automatycznie konwertowany; użyj osobnego importu RPF7. Szyfrowane RPF nie są obsługiwane.
- Nie ma jeszcze edycji geometrii `.yft` ani bezpośredniego malowania tekstur `.ytd`; możesz podmienić gotowe pliki.
- Edytor obsługuje **jeden pojazd** na resource. Dodatkowe YFT niezwiązane z głównym autem blokują eksport.
- Własne skrypty znajdujące się w ZIP mogą zawierać złośliwy kod. **Kurogane nigdy ich nie uruchamia, ale FiveM może to zrobić po wgraniu zasobu na serwer.** Przed instalacją przejrzyj ich kod. Dotyczy to również zachowanego `fxmanifest.lua`.
- Zmiany parametrów w GUI są źródłem wartości odpowiednich właściwości META. Jeśli edytujesz ręcznie plik META i później zmienisz ustawienia GUI, te ostatnie zostaną uwzględnione w eksporcie.

## Testowanie

```powershell
npm install
npm test
npm run build
npm run tauri dev
```

Testy CI dodatkowo kompilują Rust i instalator Windows. Samo wygenerowanie poprawnej struktury ZIP nie zastępuje sprawdzenia auta w FiveM.
