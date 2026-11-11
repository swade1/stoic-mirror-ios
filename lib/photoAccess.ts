import * as MediaLibrary from 'expo-media-library';

export type PhotoAccess = 'all' | 'limited' | 'none';

// How much of the Photos library iOS lets the app see. "Limited" means the
// user chose "Select Photos": the system picker still returns photos they
// haven't shared with the app, but looking one up again afterwards by its
// asset id fails — so those slides show as "no longer available".
export async function getPhotoAccess(): Promise<PhotoAccess> {
  try {
    const p = await MediaLibrary.getPermissionsAsync();
    return p.accessPrivileges ?? (p.granted ? 'all' : 'none');
  } catch {
    return 'all';
  }
}
