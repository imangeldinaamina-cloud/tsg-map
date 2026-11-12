import { ImageResponse } from "next/og";

export const alt = "TSG — service gap index. Agent-based model of Taldykorgan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GLYPHS: Record<string, string[]> = {
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
};
const PX = 22;

export default function OgImage() {
  const px: [number, number][] = [];
  ["T", "S", "G"].forEach((ch, li) => GLYPHS[ch].forEach((row, y) => [...row].forEach((b, x) => b === "1" && px.push([(li * 6 + x) * PX, y * PX]))));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FBF7FF", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 620 }}>
          <div style={{ display: "flex", fontSize: 26, color: "#7E3FA6", fontWeight: 700 }}>School research project · Taldykorgan</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 62, lineHeight: 1.1, color: "#27152B", fontWeight: 800 }}>Agent-based model of Taldykorgan</div>
            <div style={{ fontSize: 32, lineHeight: 1.3, color: "#27152B", marginTop: 20 }}>Where services are missing at the hour people are there</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#27152B", background: "#B7DB8C", border: "4px solid #27152B", borderRadius: 999, padding: "10px 28px", alignSelf: "flex-start" }}>
            tsg-map.vercel.app
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", position: "relative", width: 470, height: 360, background: "#BD75F3", border: "6px solid #27152B", borderRadius: 40, boxShadow: "12px 12px 0 #27152B", transform: "rotate(-4deg)" }}>
            <div style={{ display: "flex", position: "absolute", left: 42, top: 92, width: 17 * PX, height: 7 * PX }}>
              {px.map(([x, y]) => (
                <div key={`o${x}-${y}`} style={{ position: "absolute", left: x - 6, top: y - 6, width: PX + 12, height: PX + 12, background: "#27152B" }} />
              ))}
              {px.map(([x, y]) => (
                <div key={`f${x}-${y}`} style={{ position: "absolute", left: x, top: y, width: PX + 1, height: PX + 1, background: "#B7DB8C" }} />
              ))}
            </div>
            <div style={{ display: "flex", position: "absolute", right: 34, top: 30, width: 44, height: 44, background: "#FFF4C9", border: "4px solid #27152B", borderRadius: 10, transform: "rotate(30deg)" }} />
            <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 34, justifyContent: "center", fontSize: 30, color: "#27152B", fontWeight: 800 }}>
              service gap index
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
