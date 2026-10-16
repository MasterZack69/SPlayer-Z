import { describe, expect, it } from "vitest";
import { parseLyric } from "lyric-kit";
import { normalizeInlineLrc, parsePlaybackLyric } from "./parse";

const collapsed =
  "[00:00.00]♪[00:07.450]И не стало улиц, лиц и площадей[00:10.790]Будто не вернулась мама из гостей[00:14.90]Ни теней, ни света, выключен торшер[00:17.950]Только чёрный цвет из всех карандашей[00:21.540]Тихо в домофонах, и не жди ответ[00:25.250]Нас давно нет дома, да и дома нет[00:28.850]Потерялась Жучка, фикус пересох[00:32.740]И увёл за ручку всех хороших Бог[00:36.690]Высоко, как на Рождество звезда[00:40.540]Глубоко, как в скважине бьёт вода[00:44.120]Хорошо, как в мамином животе[00:47.870]Сделаешь шаг — вот уже и предел[00:52.580]♪[01:06.430]И закрылись двери, больше не пройти[01:09.420]И завыли звери бывшие людьми[01:13.340]В ожидании замер огонёк свечи[01:16.970]Не узнать их с камер, лиц не различить[01:20.870]И седых забрали, и румяных крох[01:24.500]Никого в подвале не оставил Бог[01:28.80]Не услышать эхо, не исчислить дней[01:31.630]Неужели сверху всё ему видней?[01:35.520]Высоко, как на Рождество звезда[01:39.480]Глубоко, как в скважине бьёт вода[01:43.180]Хорошо, как в мамином животе[01:46.700]Сделаешь шаг — вот уже и предел[01:51.790]♪[02:05.600]Высоко, как на Рождество звезда[02:08.970]Глубоко, как в скважине бьёт вода[02:12.740]Хорошо, как в мамином животе[02:16.470]Сделаешь шаг — вот уже и предел";

describe("collapsed plain LRC recovery", () => {
  it("renders every timestamp in the supplied Russian song as a separate line", () => {
    const { lines } = parsePlaybackLyric({ content: collapsed }, "lrc");
    expect(lines).toHaveLength(31);
    expect(lines[1]).toMatchObject({
      startTime: 7450,
      words: [{ word: "И не стало улиц, лиц и площадей", startTime: 7450 }],
    });
    expect(lines[3].startTime).toBe(14900);
    expect(lines.at(-1)).toMatchObject({
      startTime: 136470,
      words: [{ word: "Сделаешь шаг — вот уже и предел" }],
    });
    expect(normalizeInlineLrc(normalizeInlineLrc(collapsed))).toBe(normalizeInlineLrc(collapsed));
  });

  it.each([
    "[00:01.00]<00:01.00>Hello <00:01.40>beautiful <00:01.80>world<00:02.40>",
    "[00:01.00]Hello [00:01.40]beautiful [00:01.80]world[00:02.40]",
    "[00:01.00]Hello [00:04.00]beautiful [00:07.00]world[00:10.00]",
    "[00:01.00][00:10.00]Repeat this chorus",
    "[bg:[00:01.00]Background phrase here[00:04.00]Another background phrase]",
    "[00:01.00]Normal first line\n[00:05.00]Normal second line",
    "[00:01.00]<00:01.00>One long phrase <00:04.00>another long phrase<00:07.00>",
    "[00:01.00]one two three [00:01.40]four five six [00:01.80]seven eight nine[00:02.40]",
  ])("preserves enhanced word cues, repeated timestamps and normal LRC: %s", (content) => {
    expect(normalizeInlineLrc(content)).toBe(content);
    expect(parsePlaybackLyric({ content }, "lrc")).toEqual(parseLyric({ content, format: "lrc" }));
  });

  it("preserves metadata and aligns collapsed translations and romanization", () => {
    const input = {
      content: "[ar:Artist]\n[00:01.00]This is first[00:05.00]This is second",
      translation: "[00:01.00]Это первая строка[00:05.00]Это вторая строка",
      romaji: "[00:01.00]eto pervaya stroka[00:05.00]eto vtoraya stroka",
    };
    const result = parsePlaybackLyric(input, "lrc", { extractMetadata: true });
    expect(result.lines).toHaveLength(2);
    expect(result.lines[1]).toMatchObject({
      translatedLyric: "Это вторая строка",
      romanLyric: "eto vtoraya stroka",
    });
    expect(result.metadata).toEqual(
      parseLyric(
        { ...input, content: normalizeInlineLrc(input.content), format: "lrc" },
        { extractMetadata: true },
      ).metadata,
    );
  });

  it("leaves TTML and other explicitly selected formats untouched", () => {
    const content =
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1s" end="3s">One line</p></div></body></tt>';
    expect(parsePlaybackLyric({ content }, "ttml")).toEqual(
      parseLyric({ content, format: "ttml" }),
    );
  });
});
