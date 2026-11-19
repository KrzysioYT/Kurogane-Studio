import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ImportedAssets } from './builder';

type NativeAsset = { name: string; dataBase64: string; source: string };
type NativeImport = { sourceName: string; assets: NativeAsset[]; ignored: number; warnings: string[] };

/** RPF7 is read by the local Rust backend. No model data is uploaded to a server. */
export async function pickRpfArchive(): Promise<ImportedAssets | null> {
  if (!isTauri()) throw new Error('Import .rpf działa wyłącznie w aplikacji Windows (Tauri), nie w przeglądarce.');
  const result = await invoke<NativeImport | null>('import_rpf');
  if (!result) return null; // User cancelled Windows file dialog
  const assets = result.assets.map(item => {
    const decoded = atob(item.dataBase64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return { name: item.name, bytes, source: item.source };
  });
  return {
    assets,
    ignored: result.ignored,
    warnings: [
      ...result.warnings,
      'RPF: import zachowuje pliki GTA/RSC7, nie jest edycją siatki 3D. Konwersja dotyczy pojedynczego pojazdu.',
    ],
  };
}
