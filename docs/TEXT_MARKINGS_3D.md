# Kurogane Studio v0.15 — napisy i numery jednostek na modelu 3D

W głównym edytorze 3D możesz teraz stworzyć i umieścić napis **bez zewnętrznego programu graficznego**:

1. W pasku nad sceną wpisz np. `LSPD`, `POLICE`, `108` lub `PATROL DIVISION`.
2. Wybierz kolor liter. Na czcionkę nakładany jest automatycznie czarny kontur, poprawiający czytelność.
3. Kliknij **Przygotuj napis 3D** — edytor zamienia tekst na wewnętrzną teksturę Canvas.
4. Wybierz szerokość w metrach, obrót i poziom krycia.
5. Kliknij docelowe miejsce na karoserii. Napis zostanie rzutowany na powierzchnię jako osobny element, podobnie jak logo PNG.
6. Zapisz plik `.kurogane` lub wyeksportuj GLB.

Dozwolone są do trzech linii, maksymalnie 100 znaków; pola sterujące są odrzucane. Napis jest renderowany lokalnie, bez usług online.

**Ważne:** tekst nie jest geometrią wypukłych liter. To powierzchniowa naklejka 3D (decal), którą można przenosić, obracać, kopiować i usuwać. Nie trafia automatycznie do natywnego słownika YTD ani do YFT GTA; dotychczasowe narzędzia edycji YTD i eksperymentalny YFT pozostają osobno. Funkcja działa w formatach projektu/GLB.

Moduł jest testowany przez GitHub Actions pod Windows, wraz z wcześniejszymi testami UV Atlas i Model Doctor. Testy w grze pozostają odłożone na życzenie użytkownika.
