import { Linking, Platform } from 'react-native';
import type { HNItem } from '../api/hn';

export function openStoryFromUI(item: HNItem) {
  const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  } else {
    Linking.openURL(url);
  }
}
