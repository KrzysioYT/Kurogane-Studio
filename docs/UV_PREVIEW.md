# Kurogane Studio v0.7 — podgląd malowania YTD na modelu YFT 3D

## Workflow krok po kroku

1. Zaimportuj ZIP addonu lub pliki `spawn.yft`, `spawn.ytd` i `.meta`.
2. Wejdź do **03 · Retexture / Loga**. Wybierz YTD i teksturę, nanieś logo, napis lub pociągnięcia pędzlem; zapisz przyciskiem **Zapisz teksturę w YTD**.
3. Przełącz się na **04 · Podgląd YFT 3D**. Załaduj `spawn.yft`.
4. Kliknij karoserię/mesh lub wybierz grupę materiału po numerze shader ID.
5. Wybierz `spawn.ytd` i teksturę; kliknij **Zobacz teksturę na modelu**.
6. Jeśli wynik pasuje do UV, wróć do edytora i nanieś poprawki. Wygeneruj addon ZIP.

**Zapis zmienionego YTD jest realny:** natywna biblioteka koduje PNG do tekstury RSC7, odtwarza mipmapy i serializuje cały YTD. **Podgląd na YFT jest orientacyjny:** Kurogane nie zna jeszcze automatycznie powiązań każdego shadera z teksturą. Ręcznie wskazujesz docelową grupę meshów. Nie modyfikuje to modelu YFT ani jego zapisanych materiałów, a diagnostyczne kolory nie są oryginalnym wyglądem auta.

## Czego brakuje do v1.0
- bezpośredniej edycji karoserii (wierzchołków i części) w YFT i odtworzenia kompletnego fragmentu GTA w zapisie;
- poprawnej obsługi szkieletu, kół, drzwi, kości, kolizji, LOD i powiązań materiałów;
- automatycznego wyboru tekstury dla shadera z danych YFT;
- testów realnego YFT/YTD z autem FiveM — działania w grze, spawnu, malowań i tekstur.

Plan: silnik graficzny 3D, a następnie bezpieczny **writer YFT** i walidacja gry, zanim nadamy status 1.0. Nie kopiujemy niejasno licencjonowanych źródeł CodeWalker. Wszystkie zależności wymagają weryfikacji ich licencji.
