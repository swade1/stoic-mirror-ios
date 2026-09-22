import AsyncStorage from '@react-native-async-storage/async-storage';

const ICLOUD_TIP_SEEN_KEY = 'has_seen_icloud_photos_tip';

export async function hasSeenICloudTip(): Promise<boolean> {
  return (await AsyncStorage.getItem(ICLOUD_TIP_SEEN_KEY)) !== null;
}

export async function markICloudTipSeen(): Promise<void> {
  await AsyncStorage.setItem(ICLOUD_TIP_SEEN_KEY, 'true');
}
