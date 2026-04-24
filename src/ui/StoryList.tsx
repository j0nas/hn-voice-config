import { useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import type { Config } from '../config/schema';
import { fetchStories } from '../api/hn';
import { useStories } from '../state/useStories';
import { StoryRow } from './StoryRow';
import { evalToBool } from '../config/expr';

export function StoryList({ cfg }: { cfg: Config }) {
  const stories = useStories((s) => s.stories);
  const loading = useStories((s) => s.loading);
  const error = useStories((s) => s.error);
  const setStories = useStories((s) => s.setStories);
  const setLoading = useStories((s) => s.setLoading);
  const setError = useStories((s) => s.setError);

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    fetchStories(cfg.feed, cfg.storyLimit, ctl.signal)
      .then((items) => {
        setStories(items);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError') {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => ctl.abort();
  }, [cfg.feed, cfg.storyLimit, setStories, setLoading, setError]);

  const visible = useMemo(() => {
    if (cfg.slots.visible == null) return stories;
    const now = Math.floor(Date.now() / 1000);
    return stories.filter((item, index) =>
      evalToBool(
        cfg.slots.visible,
        {
          index,
          rank: index + 1,
          total: stories.length,
          item,
          now,
          feed: cfg.feed,
          storyLimit: cfg.storyLimit,
        },
        true,
      ).value,
    );
  }, [cfg.slots.visible, cfg.feed, cfg.storyLimit, stories]);

  if (error) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: cfg.palette.foreground }}>Error: {error}</Text>
      </View>
    );
  }
  if (loading && stories.length === 0) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator color={cfg.palette.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      {visible.map((item, idx) => (
        <StoryRow key={item.id} cfg={cfg} item={item} index={idx} total={visible.length} />
      ))}
      {visible.length === 0 && (
        <Text style={{ padding: 16, color: cfg.palette.muted }}>
          No stories match the filter.
        </Text>
      )}
    </ScrollView>
  );
}
