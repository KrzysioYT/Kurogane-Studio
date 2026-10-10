# Kurogane Studio v0.8 — Vertex Modeler (GLB)

## Dostępne funkcje
W głównym **Edytorze 3D** (nie FiveM Add-on) możesz teraz:

- utworzyć bryłę: sześcian, kulę, walec, stożek lub płaszczyznę;
- wybrać część modelu, zduplikować ją do niezależnej siatki i materiału;
- włączyć **Edycję wierzchołków**, kliknąć trójkąt siatki 3D i wskazać najbliższy z jego trzech wierzchołków;
- przeciągać pomarańczowy manipulator w 3D, aby zmienić współrzędne wybranego wierzchołka, lub edytować X/Y/Z w inspektorze;
- przeliczyć normalne i zastosować odbicie lustrzane po osiach X/Y/Z;
- importować własne GLB/OBJ, zmieniać materiały i eksportować geometrię do GLB.

**Krytyczne ograniczenie:** to jest edytor niezależnych meshów do formatu GLB, nie writer fragmentów GTA V. Eksport GLB nie tworzy od razu modelu YFT dla FiveM.

## Różnica względem GTA
Podgląd YFT z zakładki **FiveM Add-on → Podgląd YFT 3D** potrafi odczytać i wyświetlić rzeczywistą geometrię pojazdu GTA, ale NIE potrafi zapisać zmian w oryginalnym pliku YFT. Program zachowuje podstawową obsługę addon ZIP, metadanych i texture YTD, ale pełny writer YFT wymaga oddzielnej implementacji lub legalnego modułu konwertującego geometrię/fragmenty.

## Bezpieczeństwo
- Przy imporcie GLB geometrie i materiały są klonowane na każdy mesh, żeby edycja jednej części nie zmieniała drugiej.
- Indeks wierzchołka oraz podane wartości są walidowane przed zapisem.
- Operacje Mirror poprawiają kolejność wierzchołków trójkątów, aby uniknąć odwrócenia normalnych.
- Testy: tworzenie wszystkich brył, niezależna kopia mesha, zmiana wierzchołka, zły indeks, odbicie, normalne, klonowane zasoby.

## Kryteria wydania 1.0
Opisane w [issue #14](https://github.com/KrzysioYT/Kurogane-Studio/issues/14): pełny writer YFT z kośćmi, kolizjami, LOD, materiałami oraz test import→edycja→export→spawn w FiveM. Nie deklarujemy tego etapu jako ukończonego bez modelu testowego i działającego procesu zapisu.
