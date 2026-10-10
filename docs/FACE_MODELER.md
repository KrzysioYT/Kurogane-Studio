# Modelowanie ścian — etap po v0.10

W edytorze 3D kliknij **Ściany**, potem trójkąt modelu. Pomarańczowe podświetlenie wskazuje wybraną powierzchnię. W inspektorze dostępne są:

- **Wyciągnij ścianę**: przesuwa trójkąt wzdłuż jego lokalnej normalnej i tworzy sześć trójkątów boków. Odległość jest w jednostkach lokalnych modelu (metry przy skali 1).
- **Podziel na 4**: dzieli wybrany trójkąt przez środki krawędzi, interpolując UV i pozostałe atrybuty.
- **Usuń ścianę**: usuwa wybrany trójkąt.
- **Cofnij / Ponów topologię**: maksymalnie 20 zapisanych operacji. Przywraca geometrię całej części, w tym ewentualne późniejsze zmiany wierzchołków tej części. Nie jest historią sceny ani materiałów. Import i ponowne wczytanie demonstracji czyszczą historię.

Wynik zapisuje się przez **Eksportuj GLB** i można go ponownie importować. Podświetlenie jest pomocniczym obiektem sceny renderera; nie wchodzi do eksportu i hierarchii.

## Granice tego etapu

To narzędzia pojedynczych trójkątów, nie pełne modelowanie samochodu do GTA. Podział może tworzyć T-junctions z sąsiadami. Wyciągnięte boki kopiują UV krawędzi (wymagają ponownego mapowania); normalne przeliczane są jako płaskie, tangenty usuwane. Edycja odrzuca rig/skinning, morph targets i niestandardowe bufory. Nie obsługuje wyboru regionów, quadowej topologii, loop cut, bevel, spawania, UV unwrap ani pełnego undo sceny.

Natywny zapis YFT pozostaje eksperymentalnym patchem istniejących pozycji; nie zapisuje nowej topologii. Do kompletnego auta FiveM nadal brakuje pełnej serializacji geometrii YFT, wag/kości, fragmentów i połączeń drzwi/kół, kolizji, bounds i LOD oraz walidacji na prawdziwym pojeździe w grze. Nie oznaczać jako 1.0.

Weryfikacja: `npm test` i `npm run build`. Testy topologii sprawdzają liczbę ścian, obszar, UV, grupy materiałowe, niezmienność źródła oraz odrzucanie nieobsługiwanych danych. Nie zastępują testu interakcji WebGL i Windows/FiveM.
