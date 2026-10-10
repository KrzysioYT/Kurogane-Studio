# Kurogane Studio v0.12 — logo 3D bez Blendera

W głównym **Edytorze 3D** możesz teraz projektować własne logo PNG/JPG/WebP **bezpośrednio na powierzchnię modelu samochodu**. To wygodna metoda tworzenia napisów i oznaczeń na częściach auta, zanim nadejdzie pełny writer YFT.

## Jak to działa

1. Otwórz projekt `.kurogane`, GLB/OBJ albo scenę demonstracyjną.
2. Kliknij **Wczytaj logo PNG / JPG** w pasku nad podglądem.
3. Ustaw szerokość w metrach, obrót i poziom krycia.
4. Kliknij **Logo na karoserii**, a następnie wybraną część samochodu w podglądzie.
5. Logo jest projektowane na jej geometrię w 3D (decal). Otrzymuje osobny mesh, który możesz wybrać, przesunąć, ukryć, zduplikować lub usunąć.
6. Zapisz projekt `.kurogane` lub wyeksportuj GLB. Logo zostanie zachowane jako część sceny; tekstura obrazu jest przenoszona przez CanvasTexture, więc projekt nie zależy od tymczasowego adresu `blob:`.

**Uwaga:** logo z tego edytora jest nakładką 3D w scenie/GLB, **nie zostaje automatycznie wpisane do pliku YTD ani YFT**. Do modyfikacji tekstury GTA służy zakładka **FiveM Add-on → Retexture / Loga**. Pełny eksport nowych części i decal do YFT nadal jest osobnym, niewykonanym etapem.

## Zabezpieczenia i limity
- PNG, JPG, WebP, maksymalnie 8 MiB i 4096 × 4096 pikseli.
- Szerokość logo 0.025–10 m, obrót ±3600°, krycie 5–100%.
- Nie można nakładać kolejnych logo na istniejące nakładki — kliknięcie trafia w karoserię pod spodem.
- Zapis operacji do historii Undo/Redo; tekstura jest przechowywana w pamięci i osadzana w projekcie GLB / `.kurogane`.
- DecalGeometry tworzy triangulowaną powierzchnię rzutowaną na model. Na silnie zakrzywionych lub złożonych powierzchniach przy dużej skali mogą pojawić się przecięcia lub artefakty.
- Testy automatyczne w `tests/decal.test.ts` sprawdzają utworzenie mesha logo, brak zmiany źródłowej geometrii i walidację ustawień. Test zachowania wyglądu na różnych autach w podglądzie Windows jest nadal konieczny.

## Dalej do wersji 1.0
- Zapis zmian topologii i nowo dodanych części bezpośrednio do GTA YFT, z obsługą kości i LOD.
- Automatyczne połączenie logo namalowanego w 3D z oryginalnym materiałem i YTD GTA.
- Reużywalne materiały, atlas UV, generowanie LOD oraz diagnostyka przed eksportem.
- Testy w FiveM zostały **odłożone na życzenie użytkownika**, a nie zakończone.
