# Kurogane Studio v0.14 — automatyczne UV Atlas

Nowa operacja w **Edytor 3D → zaznacz część → UV i teksturowanie → Automatyczny atlas UV (0–1)**.

## Co robi
- Na podstawie pozycji wierzchołków i normalnych rozpoznaje sąsiadujące trójkąty tworzące przybliżoną powierzchnię płaską (kąt do 12°), nie łączy fragmentów z różnych slotów materiałów.
- Tworzy niezależne wyspy UV na rozłącznych kafelkach tekstury 0–1, z marginesem ok. 7% po bokach.
- Rozcina indeksowaną geometrię do wierzchołków niezależnych per trójkąt, aby wyspy mogły mieć różne UV.
- Zachowuje oryginalne atrybuty i grupy materiałów. Wynik działa w eksporcie GLB i w projektach `.kurogane`.
- Operacja jest objęta historią Undo/Redo. Oryginalna geometria nie jest nadpisywana przed pomyślnym przygotowaniem atlasu.

## Znane ograniczenia
- Do 80 000 trójkątów i maksymalnie 4096 wysp na pojedynczy mesh.
- Rozdzielne kafelki **nie nakładają się na siebie**, ale atlas nie gwarantuje braku nakładania się samych trójkątów **wewnątrz tej samej wyspy**, jeśli powierzchnia nie jest dokładnie płaska lub jest zagięta.
- Proste pakowanie kafelkowe bywa mniej efektywne niż zaawansowany algorytm UV unwrap: przy wielu drobnych częściach pozostaje niewykorzystane miejsce, więc może pogorszyć rozdzielczość tekstury.
- Operacja tworzy nowe współrzędne UV; wcześniej ręcznie przygotowane UV zostają zastąpione. Przed użyciem zapisz projekt.
- Operacja jest przeznaczona dla statycznych meshów GLB/OBJ. Zmiana topologii przez rozdzielenie wierzchołków **nie jest możliwa do zapisu** obecnym eksperymentalnym patchem YFT.
- Testy FiveM nadal odroczone zgodnie z życzeniem użytkownika.

## Testy
`tests/uv-atlas.test.ts`: sześć ścian sześcianu, rozdzielne trójkąty, brak zmian oryginalnego pliku i odmowa dla nieprawidłowej geometrii.
