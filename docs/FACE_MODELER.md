# Kurogane Studio 0.11 — warsztat modelowania

## Modelowanie i składanie auta

1. **Nowa scena** czyści model (operację można cofnąć). **Dodaj bryłę** wstawia obiekt, **Dodaj model/część** importuje GLB/GLTF/OBJ do istniejącej sceny. **Importuj model** zastępuje scenę.
2. **Ściany** włącza wybieranie trójkątów. Shift + klik dodaje/odejmuje trójkąt. W inspektorze **Połączona płaska powierzchnia** rozszerza wybór po wspólnych krawędziach. **Wszystkie ściany** wybiera całą część.
3. **Wyciągnij region** przesuwa wybrane powierzchnie wzdłuż wspólnego uśrednionego kierunku i tworzy boki wyłącznie na brzegu regionu. **Podziel ×4**, **Usuń region**, **Inset** pojedynczego trójkąta oraz **Oddziel jako część** zmieniają topologię.
4. **Edycja wierzchołków**: manipulator lub pola XYZ. Łączenie zbieżnych punktów zapobiega rozrywaniu szwów geometrii. Symetria działa względem lokalnej płaszczyzny X=0; miękki promień deformuje pobliskie punkty malejącą wagą.
5. **Pivot do środka** i **Utrwal transformację** zachowują położenie powierzchni w świecie. Operacje wymagają zwykłej części bez dzieci; utrwalenie wymaga dodatniego wyznacznika skali.
6. **Spawaj zgodne wierzchołki** łączy pełne zgodne rekordy, zachowując różne UV/normalne. **Wygładź normalne** uśrednia normalne zbieżnych punktów również przez szwy UV.

## UV, materiały i przygotowanie części

Inspektor udostępnia projekcje XY/XZ/YZ/box, podgląd UV, skalowanie/przesuwanie/obrót UV. Dla wielomateriałowych części można wybrać slot i edytować jego kolor, teksturę, metaliczność oraz szorstkość. Materiały nie-PBR można przekonwertować.

Rola samochodowa (np. `door_dside_f`, `wheel_lf`) i oznaczenie LOD trafiają do metadanych części. Można nadać nazwę według roli. **Nie tworzy to kości, rigowania ani fizyki GTA.** Kontrola siatki pokazuje nieprawidłowe dane, zerowe trójkąty, otwarte i non-manifold krawędzie.

## Widok i historia

Perspektywa oraz sześć rzutów ortograficznych; podgląd siatki; snap 0.1 jednostki / 15° / 0.1 skali; układ lokalny/światowy. Pomocnicze podświetlenia i siatka nie trafiają do eksportu.

- W/E/R: przesuwanie / obrót / skala; F: dopasuj widok; Escape: usuń zaznaczenie.
- Ctrl+Z: cofnij; Ctrl+Shift+Z lub Ctrl+Y: ponów; Ctrl+D: duplikuj; Delete: usuń część; Ctrl+S: zapisz projekt.
- Skróty nie przechwytują pisania w polach ani zakładki FiveM.
- Historia sceny obejmuje geometrię, obiekty, transformacje, materiały, widoczność, nazwy i import. Limit: 30 zmian i 128 MiB buforów poprzednich stanów. Edycja nowej gałęzi historii usuwa redo. Historia nie jest zapisywana na dysk. W trakcie przeciągania powstaje jeden checkpoint, pola liczbowe/suwaki zapisują kolejne zmiany.

## Zapis i YFT

**Zapisz projekt** tworzy samowystarczalny `.kurogane` (ZIP z `project.json`) zawierający również ukryte części, zmienioną geometrię brył, materiały, osadzone tekstury i metadane. **Otwórz projekt** przywraca je. Limit danych JSON po rozpakowaniu: 128 MiB. To projekt edytora 3D, nie zapis addonu z zakładki FiveM.

**Eksportuj GLB** eksportuje widoczne obiekty; nie zastępuje zapisu projektu. Zakładka FiveM zachowuje stan po przełączeniu do edytora podczas tej samej sesji.

Edytor istniejących YFT ma osobne cofanie/ponawianie punktów (20 stanów / 64 MiB), miękki promień, symetrię i widoki techniczne. Zapis nadal obsługuje wyłącznie pozycje istniejących Float3; limit 20 000 zmian i 4 jednostek GTA na punkt. Historia YFT czyści się po udanym zapisie i wczytaniu innego pliku. Walidacja niezmienionych punktów w Rust jest teraz liniowa zamiast wyszukiwania każdej poprawki dla każdego wierzchołka.

## Znane ograniczenia

To edytor trójkątów, nie odpowiednik pełnego DCC. Częściowy podział może tworzyć T-junctions. Wyciągnięte boki dziedziczą UV krawędzi i wymagają ponownego mapowania; box UV może nakładać wyspy. Inset obsługuje jeden trójkąt. Operacje topologii przeliczają płaskie normalne i usuwają tangenty. Edycja topologii nie obsługuje skinning/morph targets. Symetria nie dodaje brakującej drugiej połowy modelu i działa tylko wewnątrz wybranej części. Pomocnicze role LOD nie generują redukcji geometrii.

Nie zaimplementowano pełnej serializacji nowej topologii YFT, rigowania, kolizji, aktualizacji bounds YFT, zaawansowanej redukcji LOD, bevel/loop cut ani automatycznego UV unwrap. Brak testu w grze nie jest jedyną różnicą dzielącą tę wersję od pełnego eksportu auta. Testy FiveM odłożono na prośbę użytkownika.

## Weryfikacja

`npm test`: testy geometrii, regionów, UV, pivotów, historii, serializacji projektu (ukryte obiekty, zmienione bryły, tekstury, sloty materiałów), przygotowania patchy YFT i poprzednich funkcji addonu.

`npm run build`: TypeScript i bundlowanie frontendu. Pozostaje ostrzeżenie o dużym bundlu.

Test przeglądarkowy: nowa scena → bryła → rzut przedni → wybór wszystkich ścian → podział → undo/redo → UV → zapis `.kurogane` → nowa scena → ponowne otwarcie. Bez błędów JavaScript. Windows i natywne komendy Rust sprawdza workflow GitHub Actions; wynik trzeba odczytać dla bieżącego commitu. Nie wykonywano testów FiveM.
