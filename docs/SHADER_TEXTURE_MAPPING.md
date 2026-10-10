# Kurogane Studio v0.9 — sugerowane tekstury dla shaderów GTA V

## Co robi nowy importer
Natywny czytnik YFT analizuje wpisy `ShaderGroup` i parametry `ShaderParameterValue::Texture`, próbuje odnaleźć teksturę w YTD po jej nazwie oraz łączy ją z grupą meshów używającą danego shader ID. Użytkownik może kliknąć **Dobierz z YFT** i zastosować pasującą teksturę na podglądzie 3D.

Ta funkcja jest **sugestią**, ponieważ GTA V ma złożone shadery (diffuse, normal, specular, bump, multi-layer itp.). Nie wszystkie modele deklarują nazwy samodzielnie, a dla części z nich trzeba nadal wskazać teksturę ręcznie. Podgląd pomija wiele właściwości materiału gry i nie zmienia materiałów w źródłowym YFT.

## Zakres v0.1–0.9
- Działający projekt desktopowy Tauri/React, edytor mesh GLB;
- Otwieranie pojedynczych ZIP addonów, edycja handling, `.meta`, plików tekstowych, zachowanie oryginalnych zasobów;
- Import niezaszyfrowanych RPF7;
- Wczytywanie/edytowanie/pakowanie prawdziwych YTD, napisy i logotypy;
- Podgląd rzeczywistej geometrii YFT w Three.js;
- Nakładanie tekstur YTD na YFT oraz propozycje przypisań;
- Edycja wierzchołków i brył w GLB, duplikacja, odbicia lustrzane.

## Co blokuje v1.0
Brak natywnego licencjonowanego serializatora **pełnych fragmentów YFT z kośćmi, strukturą pojazdu, LOD, kolizjami** oraz pełnego testu import→modelowanie→YFT→FiveM na rzeczywistym samochodzie użytkownika. Wersja 0.9 to **preview rozwoju, NIE RC ani ukończony 1.0**. Szczegóły w [issue #14](https://github.com/KrzysioYT/Kurogane-Studio/issues/14).
