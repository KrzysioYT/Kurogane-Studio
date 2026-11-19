# Kurogane Studio v0.16 — malowanie logo bezpośrednio na GTA YTD przez kliknięcie w YFT

To pierwszy moduł, który łączy podgląd **prawdziwego modelu GTA YFT** i zapis **prawdziwego YTD** w jeden proces. Nie wymaga Blendera ani ręcznej edycji współrzędnych na płaskiej teksturze.

## Jak używać

1. Otwórz **FiveM Add-on** i zaimportuj ZIP z plikami `stream/nazwa.yft`, `stream/nazwa.ytd` i META.
2. Przejdź do **Podgląd YFT 3D**, wybierz model i odczytaj jego części.
3. W sekcji shadera wybierz grupę materiału, plik YTD i teksturę. W razie potrzeby kliknij **Dobierz z YFT** lub ręcznie wskaż materiał; sprawdź wizualizację przez **Zobacz teksturę na modelu**.
4. Wczytaj własne logo PNG/JPEG/WebP (do 8 MiB i maks. 4096×4096).
5. Ustaw szerokość naklejki w pikselach tekstury i kąt obrotu.
6. Kliknij **Maluj logo na YFT → YTD**, potem docelowe miejsce na karoserii w podglądzie 3D.
7. Program pobiera UV klikniętego trójkąta, dekoduje wybraną teksturę z YTD, maluje na niej logo, kompresuje i zapisuje słownik RSC7. Pozostałe tekstury w YTD są zachowywane.
8. Eksportuj nową paczkę w **Eksportuj addon ZIP**. Oryginalny ZIP pozostaje bez zmian. W zakładce Retexture możesz też użyć **Przywróć YTD**, aby cofnąć zmiany do pierwszej wersji projektu.

## Granice bezpieczeństwa i kompatybilności
- Operacja wymaga UV wybranego trójkąta w zakresie **0–1**. Modele z tilingiem UV lub shaderem bez pasującej tekstury są celowo odrzucane, aby uniknąć błędnego malowania.
- Ręcznie wybierasz docelowy shader/teksturę. Skomplikowane materiały GTA mają wiele map (diffuse, normal, specular): maluj tylko na właściwej mapie koloru. Program nie może automatycznie odtworzyć wszystkich niestandardowych shaderów.
- Współrzędne UV są przekształcane do PNG ze zmianą pionowej osi (UV 0,0 → dolny lewy piksel). Efekt potwierdzi podgląd. Nieznane orientacje atlasów należy sprawdzić ręcznie.
- Rozmiar logo 8–2048 px; obraz jest stemplowany na istniejącej teksturze bez zmiany rozdzielczości YTD.
- Wprowadzane zmiany dotyczą tylko YTD; nie zmieniają siatki, kości, kolizji ani LOD w YFT.
- Sam zapis RSC7 i parsowanie walidacyjne nie dowodzą pełnej kompatybilności renderingu GTA. Testy w FiveM **odłożone na prośbę użytkownika**.
- Format RSC8/Gen9 i zaszyfrowane zasoby nie są obsługiwane przez ten etap.

## Testy
`tests/paint-uv.test.ts` sprawdza mapowanie współrzędnych UV do pikseli PNG, pionową oś, nieprawidłowy tiling i granice rozmiarów logo.

`src-tauri/src/ytd.rs` zawiera test natywnej serializacji RSC7 YTD oraz ponownego odczytu.

Wymagane przed wydaniem pełnego 1.0: kompletny zapis nowej topologii YFT i test wszystkich struktur samochodu.
