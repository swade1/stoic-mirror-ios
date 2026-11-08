import { Alert } from 'react-native';
import { showSoundtrackSheet, soundtrackLabel } from '@/lib/soundtrackSheet';

const soundtracks = [
  { id: 'a', name: 'Rain' },
  { id: 'b', name: 'Evening' },
];

describe('showSoundtrackSheet', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  const buttons = () => alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];

  it('marks "No music" with a check when nothing is assigned', () => {
    showSoundtrackSheet({ slideshowName: 'Mine', currentId: null, soundtracks, onAssign: jest.fn(), onManage: jest.fn() });
    expect(alertSpy.mock.calls[0][0]).toBe('Choose music');
    expect(buttons().map((b) => b.text)).toEqual(['Cancel', '✓ No music', 'Rain', 'Evening', 'Manage or Create Soundtracks…']);
  });

  it('marks the assigned soundtrack with a check', () => {
    showSoundtrackSheet({ slideshowName: 'Mine', currentId: 'b', soundtracks, onAssign: jest.fn(), onManage: jest.fn() });
    expect(buttons().map((b) => b.text)).toEqual(['Cancel', 'No music', 'Rain', '✓ Evening', 'Manage or Create Soundtracks…']);
  });

  it('skips the sheet and starts a new soundtrack when there are none', () => {
    const onManage = jest.fn();
    showSoundtrackSheet({ slideshowName: 'Mine', currentId: null, soundtracks: [], onAssign: jest.fn(), onManage });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onManage).toHaveBeenCalledWith(true);
  });

  it('routes each choice to the right callback', () => {
    const onAssign = jest.fn();
    const onManage = jest.fn();
    showSoundtrackSheet({ slideshowName: 'Mine', currentId: null, soundtracks, onAssign, onManage });
    buttons()[2].onPress!();
    buttons()[1].onPress!();
    buttons()[4].onPress!();
    expect(onAssign).toHaveBeenNthCalledWith(1, 'a');
    expect(onAssign).toHaveBeenNthCalledWith(2, null);
    expect(onManage).toHaveBeenCalledTimes(1);
  });
});

describe('soundtrackLabel', () => {
  it('shows the name, or None when unassigned or no longer present', () => {
    expect(soundtrackLabel('a', soundtracks)).toBe('Rain');
    expect(soundtrackLabel(null, soundtracks)).toBe('None');
    expect(soundtrackLabel('gone', soundtracks)).toBe('None');
  });
});
