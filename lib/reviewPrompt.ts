import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_PROMPTED_KEY = 'has_requested_app_review';
const MILESTONE_ENTRY_COUNT = 3;

/**
 * Requests Apple's native App Store rating prompt (SKStoreReviewController)
 * — a system sheet Apple does not allow apps to restyle, by design, so it
 * will always look like standard iOS UI rather than matching the app.
 * What's within our control is *when* it's asked for: only once ever per
 * install, and only after the user has reached a genuine positive
 * milestone (a few completed counsel sessions), never on first launch or
 * mid-task. The OS itself also throttles how often it will actually
 * display the sheet regardless of how often this is called.
 */
export async function maybeRequestReview(totalEntries: number): Promise<void> {
  if (totalEntries < MILESTONE_ENTRY_COUNT) return;

  const alreadyPrompted = await AsyncStorage.getItem(HAS_PROMPTED_KEY);
  if (alreadyPrompted) return;

  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return;

  await AsyncStorage.setItem(HAS_PROMPTED_KEY, 'true');
  await StoreReview.requestReview();
}
