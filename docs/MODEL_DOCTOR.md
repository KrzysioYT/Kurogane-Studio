# Kurogane Studio v0.13 — Model Doctor

Program ma teraz **audyt geometrii 3D przed eksportem**. Otwórz model GLB/OBJ/projekt `.kurogane` i wybierz w górnym pasku **Model Doctor**.

### Co kontroluje
- Błędne indeksy trójkątów, wierzchołki NaN/Infinity oraz niepełne bufory pozycji
- Trójkąty o zerowej powierzchni, brakujące lub niedopasowane normalne
- Brakujące/niespójne współrzędne UV; materiał ma teksturę, ale mesh nie ma UV
- Krawędzie należące do więcej niż dwóch ścian (non-manifold) oraz otwarte brzegi
- Degenerujące/skrajne transformacje oraz powtórzone role kół i drzwi

Kliknij wpis w raporcie, aby zaznaczyć odpowiednią część i poprawić ją w edytorze. Wynik oznacza się jako nieaktualny, jeśli geometria ulegnie zmianie.

### Wydajność i bezpieczeństwo
- Audyt jest **tylko do odczytu**, nie modyfikuje oryginalnej siatki i nie uruchamia cudzych skryptów.
- Automatycznie skanuje do 150 000 trójkątów na wywołanie. Pozostałe oznacza w raporcie, zamiast zamrażać UI.
- Diagnostyka krawędzi korzysta z pozycji wierzchołków zaokrąglonych do 1e-5; w pewnych siatkach z nietypową topologią nie musi odpowiadać definicji spójności przez identyfikatory.
- Otwarte brzegi nie muszą oznaczać błędu: karoseria, obiekty dekoracyjne i wnętrza mogą być celowo otwarte; decals są wyłączone z tego ostrzeżenia.
- Nie bada riggingu, fizyki, LOD, kolizji ani poprawności formatu YFT. Nie potwierdza działania w FiveM.

### Testy
Plik `tests/model-audit.test.ts` sprawdza zdrowe meshe, zepsute indeksy, braki UV, trójkąty zerowe, duplikaty części oraz wyjątek dla naklejek 3D.

Wynik pozytywny **nie oznacza** poprawności samochodu w GTA V.
