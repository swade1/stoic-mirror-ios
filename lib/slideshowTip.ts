import AsyncStorage from '@react-native-async-storage/async-storage';

const ICLOUD_TIP_SEEN_KEY = 'has_seen_icloud_photos_tip';

export async function hasSeenICloudTip(): Promise<boolean> {
  return (await AsyncStorage.getItem(ICLOUD_TIP_SEEN_KEY)) !== null;
}

export async function markICloudTipSeen(): Promise<void> {
  await AsyncStorage.setItem(ICLOUD_TIP_SEEN_KEY, 'true');
}

const SLIDESHOW_NUDGE_SEEN_KEY = 'has_seen_make_slideshow_nudge';

// The one-time "make a slideshow" suggestion shown right after a user's
// first saved quote on Received Wisdom.
export async function hasSeenSlideshowNudge(): Promise<boolean> {
  return (await AsyncStorage.getItem(SLIDESHOW_NUDGE_SEEN_KEY)) !== null;
}

export async function markSlideshowNudgeSeen(): Promise<void> {
  await AsyncStorage.setItem(SLIDESHOW_NUDGE_SEEN_KEY, 'true');
}

const TEXT_BOX_HINT_SEEN_KEY = 'has_seen_text_box_hint';

// The card editor's "drag to move, tap to edit" hint, shown until the user
// first moves or edits a text block.
export async function hasSeenTextBoxHint(): Promise<boolean> {
  return (await AsyncStorage.getItem(TEXT_BOX_HINT_SEEN_KEY)) !== null;
}

export async function markTextBoxHintSeen(): Promise<void> {
  await AsyncStorage.setItem(TEXT_BOX_HINT_SEEN_KEY, 'true');
}
