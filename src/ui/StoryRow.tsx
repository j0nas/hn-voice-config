import { Fragment } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { HNItem } from '../api/hn';
import { type Config, SLOT_DEFAULTS, META_SLOT_KEYS } from '../config/schema';
import { evalToString } from '../config/expr';
import { openStoryFromUI } from './openStory';

type Props = { cfg: Config; item: HNItem; index: number; total: number };

export function StoryRow({ cfg, item, index, total }: Props) {
  const ctx = {
    index,
    rank: index + 1,
    total,
    item,
    now: Math.floor(Date.now() / 1000),
    feed: cfg.feed,
    storyLimit: cfg.storyLimit,
  };
  const style = cfg.style ?? {};

  const rankExpr = cfg.slots.rank ?? SLOT_DEFAULTS.rank;
  const titleExpr = cfg.slots.title ?? SLOT_DEFAULTS.title;
  const domainExpr = cfg.slots.domain ?? SLOT_DEFAULTS.domain;

  const rank = evalToString(rankExpr, ctx, '').value;
  const title = evalToString(titleExpr, ctx, item.title ?? '(no title)').value;
  const domain = evalToString(domainExpr, ctx, '').value;
  const metaParts = META_SLOT_KEYS.map((k) => ({
    key: k,
    text: evalToString(cfg.slots[k] ?? SLOT_DEFAULTS[k], ctx, '').value,
  })).filter((p) => p.text !== '');

  return (
    <Pressable
      onPress={() => openStoryFromUI(item)}
      style={[
        {
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: cfg.palette.muted + '33',
          flexDirection: 'row',
          gap: 10,
          alignItems: 'flex-start',
        },
        style.row,
      ]}
    >
      {rank !== '' && (
        <Text
          style={[
            { color: cfg.palette.muted, minWidth: 32, fontVariant: ['tabular-nums'] },
            style.rank,
          ]}
        >
          {rank}
        </Text>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[{ color: cfg.palette.foreground, fontSize: 15 }, style.title]}>
          {title}
          {domain !== '' && (
            <Text style={[{ color: cfg.palette.muted, fontSize: 12 }, style.domain]}>
              {domain}
            </Text>
          )}
        </Text>
        {metaParts.length > 0 && (
          <Text style={{ color: cfg.palette.muted, fontSize: 12, marginTop: 2 }}>
            {metaParts.map((p, i) => (
              <Fragment key={p.key}>
                {i > 0 ? ' · ' : ''}
                <Text style={style[p.key]}>{p.text}</Text>
              </Fragment>
            ))}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
