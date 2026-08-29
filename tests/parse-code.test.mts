import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ENTRY_CODE_LENGTH,
  PERSONAL_CODE_LENGTH,
  extractEntryCode,
  extractPersonalCode,
} from "../lib/parse-code.ts";

const ENTRY = "JOINNCU1"; // 8 碼
const PERSONAL = "AB2CD3EF4GH5"; // 12 碼

describe("代碼解析", () => {
  it("代碼長度不同，這是手動輸入時唯一的區分依據", () => {
    assert.equal(ENTRY.length, ENTRY_CODE_LENGTH);
    assert.equal(PERSONAL.length, PERSONAL_CODE_LENGTH);
  });

  describe("掃到的網址", () => {
    it("/join/ 是報到碼", () => {
      const url = `https://example.com/join/${ENTRY}`;
      assert.equal(extractEntryCode(url), ENTRY);
      assert.equal(extractPersonalCode(url), null);
    });

    it("/c/ 是個人碼", () => {
      const url = `https://example.com/c/${PERSONAL}`;
      assert.equal(extractPersonalCode(url), PERSONAL);
      assert.equal(extractEntryCode(url), null);
    });

    it("不相關的網址兩者都不是", () => {
      const url = "https://example.com/some/other/page";
      assert.equal(extractEntryCode(url), null);
      assert.equal(extractPersonalCode(url), null);
    });
  });

  describe("手動輸入的純代碼", () => {
    it("八碼只會被當成報到碼", () => {
      assert.equal(extractEntryCode(ENTRY), ENTRY);
      assert.equal(
        extractPersonalCode(ENTRY),
        null,
        "兩個函式若同時回傳值，呼叫端就分不出使用者輸入的是哪一種碼",
      );
    });

    it("十二碼只會被當成個人碼", () => {
      assert.equal(extractPersonalCode(PERSONAL), PERSONAL);
      assert.equal(extractEntryCode(PERSONAL), null);
    });

    it("長度不符的輸入兩者都不是", () => {
      for (const bad of ["ABC", "TOOLONGTOOLONGTOOLONG"]) {
        assert.equal(extractEntryCode(bad), null, bad);
        assert.equal(extractPersonalCode(bad), null, bad);
      }
    });

    it("轉成大寫，使用者不必自己切換鍵盤", () => {
      assert.equal(extractEntryCode(ENTRY.toLowerCase()), ENTRY);
      assert.equal(extractPersonalCode(PERSONAL.toLowerCase()), PERSONAL);
    });

    it("前後空白不影響，貼上時常會多帶", () => {
      assert.equal(extractEntryCode(`  ${ENTRY} `), ENTRY);
    });

    it("含符號的輸入不被接受", () => {
      assert.equal(extractEntryCode("JOIN-NCU"), null);
    });
  });
});
