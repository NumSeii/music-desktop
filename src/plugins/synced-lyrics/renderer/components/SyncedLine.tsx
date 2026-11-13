import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  Show,
} from 'solid-js';
import { type VirtualizerHandle } from 'virtua/solid';

import { type LineLyrics, type LineWord } from '@/plugins/synced-lyrics/types';

import {
  CLOCK_TICK_MS,
  glowAnimation,
  splitLetters,
  wordProgress,
} from './word-animation';

import { _ytAPI } from '..';
import { config, currentTime } from '../renderer';
import {
  canonicalize,
  convertChineseCharacter,
  romanize,
  simplifyUnicode,
} from '../utils';

interface SyncedLineProps {
  scroller: VirtualizerHandle;
  index: number;

  line: LineLyrics;
  status: 'upcoming' | 'current' | 'previous';
}

const EmptyLine = (props: SyncedLineProps) => {
  const states = createMemo(() => {
    const defaultText = config()?.defaultTextString ?? '';
    return Array.isArray(defaultText) ? defaultText : [defaultText];
  });

  const index = createMemo(() => {
    const progress = currentTime() - props.line.timeInMs;
    const total = props.line.duration;

    const percentage = Math.min(1, progress / total);
    return Math.max(0, Math.floor((states().length - 1) * percentage));
  });

  return (
    <div
      class={`synced-line ${props.status}`}
      onClick={() => {
        _ytAPI?.seekTo((props.line.timeInMs + 10) / 1000);
      }}
    >
      <div class="description ytmusic-description-shelf-renderer" dir="auto">
        <yt-formatted-string
          text={{
            runs: [
              {
                text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
              },
            ],
          }}
        />

        <div class="text-lyrics">
          <span>
            <span>
              <Show
                fallback={
                  <yt-formatted-string
                    text={{ runs: [{ text: states()[0] }] }}
                  />
                }
                when={states().length > 1}
              >
                <yt-formatted-string
                  text={{
                    runs: [
                      {
                        text: states().at(
                          props.status === 'current' ? index() : -1,
                        )!,
                      },
                    ],
                  }}
                />
              </Show>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

type WordState = 'upcoming' | 'active' | 'sung';

/**
 * One word of a karaoke line. When it starts being sung, a sweep runs from its
 * first letter to its last one, over most of the time the word lasts (the
 * timestamp of the next word minus its own). The sweep is the value of
 * `--lyrics-progress`, and every letter derives its own opacity from it.
 */
const SyncedWord = (props: {
  word: LineWord;
  status: SyncedLineProps['status'];
}) => {
  const state = createMemo<WordState>(() => {
    // Only the current line needs the clock, other lines stay static.
    if (props.status !== 'current') {
      return props.status === 'previous' ? 'sung' : 'upcoming';
    }

    const elapsed = currentTime() - props.word.timeInMs;
    if (elapsed < 0) return 'upcoming';
    return elapsed >= props.word.duration ? 'sung' : 'active';
  });

  const text = createMemo(() => {
    let word = props.word.word;
    const convertChineseText = config()?.convertChineseCharacter;
    if (convertChineseText && convertChineseText !== 'disabled') {
      word = convertChineseCharacter(word, convertChineseText);
    }
    return word;
  });

  const letters = createMemo(() => splitLetters(text()));

  // Where the sweep has to be when the next tick of the clock arrives. A CSS
  // transition (see style.css) glides there, which keeps the sweep smooth,
  // follows seeks, and stops by itself when the player is paused.
  const progress = createMemo(() => {
    switch (state()) {
      case 'upcoming':
        return 0;
      case 'sung':
        return 1;
      default:
        return wordProgress(
          currentTime() + CLOCK_TICK_MS - props.word.timeInMs,
          props.word.duration,
        );
    }
  });

  // The animation string stays the same from active to sung, so it is not
  // restarted when the word ends.
  const animation = createMemo(() =>
    props.status === 'current' && state() !== 'upcoming'
      ? glowAnimation(props.word.duration, config()?.lineEffect === 'fancy')
      : 'none',
  );

  return (
    <span
      class={`lyric-word ${state()}`}
      style={{
        '--lyrics-letters': letters().length,
        '--lyrics-progress': progress(),
        'animation': animation(),
      }}
    >
      <Index each={letters()}>
        {(letter, index) => (
          <span class="lyric-char" style={{ '--lyrics-index': index }}>
            {letter()}
          </span>
        )}
      </Index>
      {props.word.space ? ' ' : ''}
    </span>
  );
};

export const SyncedLine = (props: SyncedLineProps) => {
  const text = createMemo(() => {
    let line = props.line.text;
    const convertChineseText = config()?.convertChineseCharacter;
    if (convertChineseText && convertChineseText !== 'disabled') {
      line = convertChineseCharacter(line, convertChineseText);
    }
    return line.trim();
  });

  const [romanization, setRomanization] = createSignal('');
  createEffect(() => {
    const input = canonicalize(text());
    if (!config()?.romanization) return;

    romanize(input).then((result) => {
      setRomanization(canonicalize(result));
    });
  });

  return (
    <Show fallback={<EmptyLine {...props} />} when={text()}>
      <div
        class={`synced-line ${props.status}`}
        onClick={() => {
          _ytAPI?.seekTo((props.line.timeInMs + 10) / 1000);
        }}
      >
        <div class="description ytmusic-description-shelf-renderer" dir="auto">
          <yt-formatted-string
            text={{
              runs: [
                {
                  text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
                },
              ],
            }}
          />

          <div
            class="text-lyrics"
            ref={(div: HTMLDivElement) => {
              // TODO: Investigate the animation, even though the duration is properly set, all lines have the same animation duration
              div.style.setProperty(
                '--lyrics-duration',
                `${props.line.duration / 1000}s`,
                'important',
              );
            }}
            style={{ 'display': 'flex', 'flex-direction': 'column' }}
          >
            <span>
              {/* Karaoke lines: every word is timed on its own. */}
              <For each={props.line.words ?? []}>
                {(word) => <SyncedWord status={props.status} word={word} />}
              </For>

              {/* Line-level lines: all words light up together, as before. */}
              <For each={props.line.words?.length ? [] : text().split(' ')}>
                {(word, index) => {
                  return (
                    <span
                      style={{
                        'transition-delay': `${index() * 0.05}s`,
                        'animation-delay': `${index() * 0.05}s`,
                      }}
                    >
                      <yt-formatted-string
                        text={{
                          runs: [{ text: `${word} ` }],
                        }}
                      />
                    </span>
                  );
                }}
              </For>
            </span>

            <Show
              when={
                config()?.romanization &&
                simplifyUnicode(text()) !== simplifyUnicode(romanization())
              }
            >
              <span class="romaji">
                <For each={romanization().split(' ')}>
                  {(word, index) => {
                    return (
                      <span
                        style={{
                          'transition-delay': `${index() * 0.05}s`,
                          'animation-delay': `${index() * 0.05}s`,
                        }}
                      >
                        <yt-formatted-string
                          text={{
                            runs: [{ text: `${word} ` }],
                          }}
                        />
                      </span>
                    );
                  }}
                </For>
              </span>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
