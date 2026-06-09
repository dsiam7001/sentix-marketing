import { Composition, getInputProps } from "remotion";
import { MainVideo } from "./MainVideo";

const DEFAULT_DATA = {
  title: "Sentix AI Demo",
  full_script: "Demo",
  music_mood: "cinematic",
  scenes: [
    { start_sec: 0, end_sec: 3, narration: "Demo", on_screen_text: "VIP = SCAM", effects: "", broll_keywords: "trading" },
    { start_sec: 3, end_sec: 8, narration: "Demo", on_screen_text: "LOGIC > SIGNAL", effects: "", broll_keywords: "candlestick" },
  ],
  asset_plan: [],
  captions: [],
  end_card: { tagline: "Logic over Signal", brand: "SENTIX AI" },
};

const FPS = 30;
const END_CARD_SEC = 2.5;
function totalDuration(scenes: any[]) {
  const last = scenes[scenes.length - 1];
  const sceneEnd = Math.max(60, Math.round((last?.end_sec ?? 30) * FPS));
  return sceneEnd + Math.round(END_CARD_SEC * FPS);
}

export const RemotionRoot = () => {
  const inputProps = (getInputProps() as any) ?? {};
  const data = Object.keys(inputProps).length ? inputProps : DEFAULT_DATA;
  return (
    <Composition
      id="main"
      component={MainVideo as any}
      durationInFrames={totalDuration(data.scenes ?? [])}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={data}
    />
  );
};
