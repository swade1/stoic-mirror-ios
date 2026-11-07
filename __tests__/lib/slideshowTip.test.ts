import { hasSeenSlideshowNudge, markSlideshowNudgeSeen } from '@/lib/slideshowTip';

describe('slideshow nudge flag', () => {
  it('is unseen until marked, then stays seen', async () => {
    expect(await hasSeenSlideshowNudge()).toBe(false);
    await markSlideshowNudgeSeen();
    expect(await hasSeenSlideshowNudge()).toBe(true);
  });
});
