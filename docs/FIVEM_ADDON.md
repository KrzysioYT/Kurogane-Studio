# Kurogane Studio 0.2 — przewodnik do pojazdu FiveM

## Import

1. Uruchom `npm run tauri dev` lub instalator Windows.
2. Kliknij `FiveM Add-on`.
3. Zaimportuj ZIP zasobu lub wybierz pliki `spawn.yft`, `spawn_hi.yft`, `spawn.ytd` oraz opcjonalnie `vehicles.meta`, `handling.meta`, `carvariations.meta`, `carcols.meta`, `vehiclelayouts.meta`.
4. Sprawdź dane podpowiedziane automatycznie z modelu i plików META.

Możesz przeciągnąć ZIP lub grupę plików do panelu. ZIP może zawierać podfoldery — Kurogane szuka nazw plików dla jednego auta; nie wykonuje dołączonych skryptów.

## Ustawienia

**Pojazd:** spawn (identyczny z plikiem YFT!), nazwa resource, nazwa wyświetlana, producent, handling ID, TXD, audioNameHash, layout, klasa, typ kół, tablice, flagi, opis, autor.

**Handling:** masa, opór, podział napędu, biegi, siła silnika, ograniczenie, hamulce, skręt, przyczepność, zawieszenie, bak, uszkodzenia.

**Zachowaj metadane:** włącz domyślnie dla aut, które mają własny tuning, syreny, ekstrasy lub skomplikowane layouty. Nie włączaj szablonu metadanych dla pojazdu specjalnego.

## Eksport

Kliknij `Eksportuj addon ZIP`; zapisz przez natywny dialog Windows. ZIP ma strukturę:

```text
ks_spawn/
  fxmanifest.lua
  vehicle_names.lua
  README_KUROGANE.txt
  server_cfg_example.txt
  data/
    vehicles.meta
    handling.meta
    carvariations.meta
    carcols.meta          # tylko jeśli był istniejący i go zachowano
    vehiclelayouts.meta   # tylko jeśli był istniejący i go zachowano
  stream/
    spawn.yft
    spawn_hi.yft
    spawn.ytd
```

Rozpakuj do `resources/[cars]`; dodaj `ensure ks_spawn` do serwer.cfg; sprawdź spawn przez istniejące polecenie serwera. Zobacz logi F8 i txAdmin. Upewnij się, że użytkownik ma prawa do modeli i tekstur.

## Czego NIE gwarantujemy

Sam import YFT do ZIP nie stanowi importu YFT jako siatki 3D; binary model pozostaje bez zmian. XML generowany na podstawie ogólnego pojazdu nie wytworzy brakujących bone IDs, kolizji, wheel anchors, syren ELS, livery dictionaries, model tuning, custom audio ani LOD. Dla customowych aut najlepiej zachować oryginalne metadane. Eksport przechodzi walidację podstawową, lecz dopiero gra potwierdza zgodność.

## Co dalej

- Pełny importer YFT/YTD i odwzorowanie drawable/skeleton/fragmentów GTA w viewport.
- Edycja ekstrasów, drzwi, kół, punktów montażu, kolizji i LOD wraz z walidacją.
- Wizualny kreator świateł/syren non-ELS, livery i carcols/carvariations.
- Podgląd fizyki i testy na serwerze FiveM.
- Ujednolicone projekty `.kurostudio` z importem/eksportem.
