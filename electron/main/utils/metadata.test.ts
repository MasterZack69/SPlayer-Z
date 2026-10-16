import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseArtists, parseGenres, formatGenres } from "./metadata";

describe("parseGenres", () => {
  it("把无空格的斜杠视为流派名称的一部分", () => {
    assert.deepEqual(parseGenres("Singer/Songwriter"), ["Singer/Songwriter"]);
    assert.deepEqual(parseGenres("R&B/Soul"), ["R&B/Soul"]);
  });

  it("空格不是分隔符", () => {
    assert.deepEqual(parseGenres("Pop Rock"), ["Pop Rock"]);
  });

  it("把无空格的 & 视为流派名称的一部分", () => {
    assert.deepEqual(parseGenres("R&B"), ["R&B"]);
    assert.deepEqual(parseGenres("R & B"), ["R & B"]);
  });

  it("按逗号、分号、斜杠与 & 拆分多个流派", () => {
    assert.deepEqual(parseGenres("Pop, Rock"), ["Pop", "Rock"]);
    assert.deepEqual(parseGenres("Pop & Rock"), ["Pop", "Rock"]);
    assert.deepEqual(parseGenres("Pop; Rock"), ["Pop", "Rock"]);
    assert.deepEqual(parseGenres("Pop // Rock"), ["Pop", "Rock"]);
    assert.deepEqual(parseGenres("Pop / Rock"), ["Pop", "Rock"]);
    assert.deepEqual(parseGenres("Pop//Rock"), ["Pop", "Rock"]);
  });

  it("保护已知的复合流派", () => {
    assert.deepEqual(parseGenres("Rock & Roll, Pop"), ["Rock & Roll", "Pop"]);
    assert.deepEqual(parseGenres("R&B/Soul; Hip Hop/Rap"), ["R&B/Soul", "Hip Hop/Rap"]);
    assert.deepEqual(parseGenres("Singer / Songwriter & Folk"), ["Singer / Songwriter", "Folk"]);
  });

  it("清理空白、引号与 ID3v1 数字流派", () => {
    assert.deepEqual(parseGenres('  "Pop"  ,  Rock '), ["Pop", "Rock"]);
    assert.deepEqual(parseGenres("(17)Rock"), ["Rock"]);
    assert.deepEqual(parseGenres("(17)"), []);
    assert.deepEqual(parseGenres("Unknown"), []);
  });

  it("忽略大小写去重并保留首次出现的写法", () => {
    assert.deepEqual(parseGenres("Pop, POP, pop"), ["Pop"]);
  });

  it("空值返回空数组", () => {
    assert.deepEqual(parseGenres(""), []);
    assert.deepEqual(parseGenres(undefined), []);
  });
});

describe("formatGenres", () => {
  it("按分隔符拼接流派", () => {
    assert.equal(formatGenres(["Pop", "Rock"]), "Pop / Rock");
    assert.equal(formatGenres([]), "");
    assert.equal(formatGenres(undefined), "");
  });
});

describe("parseArtists", () => {
  it("preserves Royal & the Serpent as one artist", () => {
    assert.deepEqual(parseArtists("Royal & the Serpent"), [{ name: "Royal & the Serpent" }]);
  });

  it("preserves tag spelling and tolerates case and spacing differences", () => {
    for (const name of [
      "royal & the serpent",
      "ROYAL & THE SERPENT",
      "Royal&the Serpent",
      "Royal  &  the  Serpent",
    ]) {
      assert.deepEqual(parseArtists(`  ${name}  `), [{ name }]);
    }
  });

  it("preserves the exception within real collaborations", () => {
    for (const separator of [
      " / ",
      " & ",
      ";",
      ", ",
      " × ",
      " | ",
      "、",
      "，",
      " feat. ",
      " ft ",
    ]) {
      assert.deepEqual(
        parseArtists(`Other Artist${separator}Royal & the Serpent${separator}Guest Artist`),
        [{ name: "Other Artist" }, { name: "Royal & the Serpent" }, { name: "Guest Artist" }],
      );
    }
    assert.deepEqual(parseArtists("Royal & the Serpent & Royal & the Serpent"), [
      { name: "Royal & the Serpent" },
      { name: "Royal & the Serpent" },
    ]);
  });

  it("does not apply the exception to partial artist names", () => {
    assert.deepEqual(parseArtists("Not Royal & the Serpent"), [
      { name: "Not Royal" },
      { name: "the Serpent" },
    ]);
    assert.deepEqual(parseArtists("Royal & the Serpentines"), [
      { name: "Royal" },
      { name: "the Serpentines" },
    ]);
    assert.deepEqual(parseArtists("Royal & the Serpent Society"), [
      { name: "Royal" },
      { name: "the Serpent Society" },
    ]);
  });

  it("keeps ordinary artist separators and empty tags unchanged", () => {
    assert.deepEqual(parseArtists("Artist A & Artist B / Artist C feat. Artist D"), [
      { name: "Artist A" },
      { name: "Artist B" },
      { name: "Artist C" },
      { name: "Artist D" },
    ]);
    assert.deepEqual(parseArtists(""), []);
    assert.deepEqual(parseArtists("  / ; &  "), []);
  });
});
