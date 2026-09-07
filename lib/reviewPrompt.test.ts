import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { maybeRequestReview } from './reviewPrompt';

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

describe('maybeRequestReview', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  it('does not prompt before the milestone entry count is reached', async () => {
    await maybeRequestReview(2);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('prompts once the milestone is reached', async () => {
    await maybeRequestReview(3);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('never prompts a second time, even if called again past the milestone', async () => {
    await maybeRequestReview(3);
    await maybeRequestReview(4);
    await maybeRequestReview(10);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('does not prompt when the store review action is unavailable', async () => {
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await maybeRequestReview(5);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });
});
