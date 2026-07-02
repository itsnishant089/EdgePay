import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';
import type { Contact } from '../types';

export const requestContactsPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'EdgePay needs access to your contacts to make payments easier.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};

export const syncLocalContacts = async (): Promise<Contact[]> => {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) return [];

  try {
    const rawContacts = await Contacts.getAll();
    const formattedContacts: Contact[] = [];

    rawContacts.forEach(rc => {
      const phoneNumbers = rc.phoneNumbers || [];
      if (phoneNumbers.length === 0) return;

      // Filter out non-mobile numbers if possible, or just take the first
      const primaryPhone = phoneNumbers[0].number.replace(/[^0-9+]/g, '');

      formattedContacts.push({
        id: rc.recordID,
        name: rc.displayName || `${rc.givenName} ${rc.familyName}`.trim() || 'Unknown',
        phone: primaryPhone,
        photo: rc.hasThumbnail ? rc.thumbnailPath : null,
        isFavorite: false,
      });
    });

    // Sort alphabetically
    return formattedContacts.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.warn('Error syncing contacts:', error);
    return [];
  }
};
