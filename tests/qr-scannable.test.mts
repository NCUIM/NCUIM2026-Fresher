import { describe, it } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import zxing from "@zxing/library";

const { RGBLuminanceSource, BinaryBitmap, HybridBinarizer, QRCodeReader } = zxing;

const SCALE = 8;
const QUIET = 4;

/**
 * 用實際的前景/背景色把 QR 畫成像素，再交給網頁掃描器真正使用的解碼器。
 *
 * 這組測試存在的理由：個人 QR 曾經被畫成亮碼配深底以融入暗色介面，
 * 結果 ZXing 完全讀不到。症狀是相機正常開啟、持續掃描、永遠不觸發，
 * 看起來像掃描程式壞掉——沒有任何 HTTP 層的測試能發現這件事。
 */
function decodeWithColors(text: string, darkHex: string, lightHex: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dark = rgb(darkHex);
  const light = rgb(lightHex);
  const dim = (size + QUIET * 2) * SCALE;

  const lum = new Uint8ClampedArray(dim * dim);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const mx = Math.floor(x / SCALE) - QUIET;
      const my = Math.floor(y / SCALE) - QUIET;
      const inside = mx >= 0 && my >= 0 && mx < size && my < size;
      const c = inside && data[my * size + mx] ? dark : light;
      lum[y * dim + x] = (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;
    }
  }

  const bitmap = new BinaryBitmap(
    new HybridBinarizer(new RGBLuminanceSource(lum, dim, dim)),
  );
  try {
    return new QRCodeReader().decode(bitmap).getText();
  } catch {
    return null;
  }
}

const ENTRY_URL = "https://example.com/join/JOINNCU1";
const COLLECT_URL = "https://example.com/c/AB2CD3EF4GH5";

describe("QR 必須能被網頁掃描器讀取", () => {
  it("報到碼的預設配色可解", () => {
    assert.equal(decodeWithColors(ENTRY_URL, "#000000", "#ffffff"), ENTRY_URL);
  });

  it("個人碼的預設配色可解", () => {
    assert.equal(decodeWithColors(COLLECT_URL, "#000000", "#ffffff"), COLLECT_URL);
  });

  it("反白的 QR 解不出來——所以任何一頁都不可以反白", () => {
    assert.equal(
      decodeWithColors(COLLECT_URL, "#e9eef9", "#060912"),
      null,
      "手機原生相機解得了反白碼，ZXing 不行。深色介面很容易讓人想這樣配色。",
    );
  });

  it("深碼配淺底可解，暗色介面要用這個方向", () => {
    assert.equal(
      decodeWithColors(COLLECT_URL, "#060912", "#e9eef9"),
      COLLECT_URL,
      "碼比底深就可以，不必是純黑白",
    );
  });
});
