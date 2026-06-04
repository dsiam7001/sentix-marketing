import { Composition, getInputProps } from "remotion";
import { MainVideo } from "./MainVideo";

// Default data lets you preview without input props. In CI we pass props via
// --props=public/data.json
const DEFAULT_DATA = {
  title: "Sentix AI Demo",
  full_script: "এই ১৫ সেকেন্ডে আপনি বুঝবেন trading logic কী।",
  music_mood: "dark cyberpunk",
  scenes: [
    {
      start_sec: 0,
      end_sec: 3,
      narration: "VIP signal বেচা মানে scam।",
      on_screen_text: "VIP = SCAM",
      effects: "zoom",
      broll_keywords: "trading chart",
    },
    {
      start_sec: 3,
      end_sec: 8,
      narration: "Logic শেখো, প্রফিট নিজে কর।",
      on_screen_text: "LOGIC > SIGNAL",
      effects: "glitch",
      broll_keywords: "candlestick",
    },
  ],
  asset_plan: [],
  srt: "",
};

const FPS = 30;
function durationFromScenes(scenes: any[]) {
  const last = scenes[scenes.length - 1];
  return Math.max(60, Math.round((last?.end_sec ?? 30) * FPS));
}

export const RemotionRoot = () => {
  const inputProps = (getInputProps() as any) ?? {};
  const data = Object.keys(inputProps).length ? inputProps : DEFAULT_DATA;
  return (
    <Composition
      id="main"
      component={MainVideo as any}
      durationInFrames={durationFromScenes(data.scenes ?? [])}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={data}
    />
  );
};
