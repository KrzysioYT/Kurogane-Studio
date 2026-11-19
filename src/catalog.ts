export type Tool = {
  id: string;
  name: string;
  description: string;
  section: 'Pojazdy' | 'Modele i mapy' | 'Postacie i ubrania' | 'Broń i serwer';
  icon: string;
  stage: 'mvp' | 'planned';
};
const item = (id: string, name: string, description: string, section: Tool['section'], icon: string, stage: Tool['stage'] = 'planned'): Tool =>
  ({ id, name, description, section, icon, stage });
export const tools: Tool[] = [
  item('vehicle-editor-v2', 'Vehicle Editor V2', 'Warsztat 3D — podstawowy edytor GLB/OBJ; pełne YFT później', 'Pojazdy', '🚘', 'mvp'),
  item('addon-car-importer', 'Add-on Car Importer', 'Import pojazdów GTA i kontrola zależności', 'Pojazdy', '📥'),
  item('els-to-nonels', 'ELS to Non-ELS', 'Konwersja oświetlenia służbowego', 'Pojazdy', '🚨'),
  item('plate-creator', 'Plate Creator', 'Tablice rejestracyjne i zestawy tekstur', 'Pojazdy', '🔢'),
  item('livery-mapper', 'Livery Mapper', 'Projektowanie malowań na modelach', 'Pojazdy', '🎨'),
  item('boat-creator', 'Boat Creator', 'Edytor łodzi i elementów pływających', 'Pojazdy', '🚤'),
  item('car-creator', 'Car Creator', 'Tworzenie samochodu od podstaw', 'Pojazdy', '🏎️'),
  item('vehicle-optimiser', 'Vehicle Optimiser', 'Walidacja i optymalizacja pojazdu', 'Pojazdy', '⚙️'),
  item('prop-creator', 'Prop Creator', 'Tworzenie obiektów świata', 'Modele i mapy', '🧱'),
  item('ai-prop-creator', 'AI Prop Creator', 'Generowanie obiektów z pomocą AI', 'Modele i mapy', '✨'),
  item('retexture', 'Retexture', 'Zmiana tekstur modeli', 'Modele i mapy', '🖌️'),
  item('shell-creator', 'Shell Creator', 'Tworzenie wnętrz typu shell', 'Modele i mapy', '🏠'),
  item('mlo-creator', 'MLO Creator', 'Narzędzia projektowania MLO', 'Modele i mapy', '🏙️'),
  item('model-converter', 'Model Converter', 'Konwersje między formatami 3D', 'Modele i mapy', '🔄'),
  item('retopo', 'Retopo', 'Upraszczanie topologii', 'Modele i mapy', '🔺'),
  item('map-optimiser', 'Map Optimiser', 'Optymalizacja map', 'Modele i mapy', '🗺️'),
  item('optimiser', 'Optimiser', 'Optymalizacja zasobów', 'Modele i mapy', '⚡'),
  item('clothing-textures', 'Clothing Textures', 'Projektowanie tekstur ubrań', 'Postacie i ubrania', '👕'),
  item('clothing-converter', 'Clothing Converter', 'Konwersja elementów garderoby', 'Postacie i ubrania', '🧥'),
  item('ped-creator', 'Ped Creator', 'Tworzenie postaci', 'Postacie i ubrania', '🧍'),
  item('tattoo-creator', 'Tattoo Creator', 'Tatuaże postaci', 'Postacie i ubrania', '🪡'),
  item('face-skin-creator', 'Face Skin Creator', 'Tekstury skóry i twarzy', 'Postacie i ubrania', '🙂'),
  item('ai-ped-creator', 'AI Ped Creator', 'Generowanie postaci AI', 'Postacie i ubrania', '🤖'),
  item('pet-creator', 'Pet Creator', 'Tworzenie modeli zwierząt', 'Postacie i ubrania', '🐾'),
  item('chain-creator', 'Chain Creator', 'Łańcuchy i akcesoria', 'Postacie i ubrania', '⛓️'),
  item('animation-creator', 'Animation Creator', 'Narzędzia animacji', 'Postacie i ubrania', '🎞️'),
  item('weapon-skins', 'Weapon Skins', 'Skórki broni', 'Broń i serwer', '🖼️'),
  item('weapon-creator', 'Weapon Creator', 'Tworzenie modeli broni', 'Broń i serwer', '🛠️'),
  item('server-hub', 'Server Hub', 'Zarządzanie paczkami zasobów FiveM', 'Broń i serwer', '🖥️'),
];
export const sections: Tool['section'][] = ['Pojazdy', 'Modele i mapy', 'Postacie i ubrania', 'Broń i serwer'];
