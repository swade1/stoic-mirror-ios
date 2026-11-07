import { Alert } from 'react-native';

export interface SoundtrackOption {
  id: string;
  name: string;
}

interface SoundtrackSheetArgs {
  slideshowName: string;
  currentId: string | null;
  soundtracks: SoundtrackOption[];
  onAssign: (soundtrackId: string | null) => void;
  onManage: () => void;
}

// A lightweight action sheet rather than a full-screen picker — lets a user
// assign, change, or clear a slideshow's soundtrack in place, with a
// "Manage or Create Soundtracks…" escape hatch to the full library (rename/delete/edit
// tracks). The current choice is marked with a checkmark prefix, since a
// native Alert's buttons can't carry any other styling. Shared by the
// Slideshows list and the slideshow screen so both behave identically.
export function showSoundtrackSheet({ slideshowName, currentId, soundtracks, onAssign, onManage }: SoundtrackSheetArgs) {
  Alert.alert('Choose music', slideshowName, [
    { text: 'Cancel', style: 'cancel' },
    { text: currentId === null ? '✓ No music' : 'No music', onPress: () => onAssign(null) },
    ...soundtracks.map((s) => ({
      text: currentId === s.id ? `✓ ${s.name}` : s.name,
      onPress: () => onAssign(s.id),
    })),
    { text: 'Manage or Create Soundtracks…', onPress: onManage },
  ]);
}

export function soundtrackLabel(currentId: string | null, soundtracks: SoundtrackOption[]): string {
  if (currentId === null) return 'None';
  return soundtracks.find((s) => s.id === currentId)?.name ?? 'None';
}
