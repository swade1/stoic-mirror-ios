jest.mock('expo-media-library', () => ({ getPermissionsAsync: jest.fn() }));

import * as MediaLibrary from 'expo-media-library';
import { getPhotoAccess } from '@/lib/photoAccess';

const mockGetPermissions = MediaLibrary.getPermissionsAsync as jest.Mock;

describe('getPhotoAccess', () => {
  it('reports the access level iOS gives', async () => {
    mockGetPermissions.mockResolvedValue({ granted: true, accessPrivileges: 'limited' });
    expect(await getPhotoAccess()).toBe('limited');
    mockGetPermissions.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
    expect(await getPhotoAccess()).toBe('all');
  });

  it('falls back to granted when no privilege level is reported', async () => {
    mockGetPermissions.mockResolvedValue({ granted: true });
    expect(await getPhotoAccess()).toBe('all');
    mockGetPermissions.mockResolvedValue({ granted: false });
    expect(await getPhotoAccess()).toBe('none');
  });

  it('assumes full access if the check itself fails', async () => {
    mockGetPermissions.mockRejectedValue(new Error('boom'));
    expect(await getPhotoAccess()).toBe('all');
  });
});
