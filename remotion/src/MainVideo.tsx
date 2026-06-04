import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/HindSiliguri";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"] });

type Scene = {
  start_sec: number;
  end_sec: number;
  narration: string;
  on_screen_text: string;
  effects?: string;
  broll_keywords?: string;
};

type AssetPick = {
  start_sec: number;
  end_sec: number;
  chosen: { source: string; url: string; preview?: string | null };
  keyword: string;
};

type Props = {
  title: string;
  full_script: string;
  music_mood?: string;
  scenes: Scene[];
  asset_plan?: AssetPick[];
  audio_url?: string | null;
};

const FPS = 30;

export const MainVideo: React.FC<Props> = (props) => {
  const { scenes, asset_plan, audio_url } = props;

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070d", fontFamily }}>
      {/* Animated background gradient */}
      <BackgroundLayer />

      {/* Scenes */}
      {scenes?.map((s, i) => {
        const from = Math.round(s.start_sec * FPS);
        const dur = Math.max(15, Math.round((s.end_sec - s.start_sec) * FPS));
        const asset = asset_plan?.find((a) => a.start_sec === s.start_sec);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <SceneRender scene={s} asset={asset} />
          </Sequence>
        );
      })}

      {/* Brand watermark */}
      <BrandStrip />

      {/* Audio (Edge-TTS generated mp3 mounted via staticFile or absolute URL) */}
      {audio_url && (
        <Audio
          src={audio_url.startsWith("http") ? audio_url : staticFile(audio_url)}
        />
      )}
    </AbsoluteFill>
  );
};

function BackgroundLayer() {
  const frame = useCurrentFrame();
  const shift = Math.sin(frame / 50) * 30;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${50 + shift}% 30%, #0e3a5f 0%, #05070d 60%)`,
      }}
    />
  );
}

function SceneRender({ scene, asset }: { scene: Scene; asset?: AssetPick }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 200 } });
  const scale = interpolate(enter, [0, 1], [1.05, 1]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  const isVideo = asset?.chosen?.url?.match(/\.(mp4|webm|mov)(\?|$)/i);

  return (
    <AbsoluteFill>
      {/* Background asset */}
      {asset?.chosen?.url && isVideo && (
        <AbsoluteFill style={{ transform: `scale(${scale})`, opacity: 0.85 }}>
          <Video
            src={asset.chosen.url}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.1) contrast(1.1)" }}
          />
        </AbsoluteFill>
      )}
      {asset?.chosen?.url && !isVideo && (
        <AbsoluteFill style={{ transform: `scale(${scale})`, opacity: 0.9 }}>
          <Img
            src={asset.chosen.url}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      )}
      {/* Dark overlay for text readability */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)" }} />

      {/* On-screen text — SAFE ZONE: avoid bottom 20%, right 15% (TikTok UI) */}
      <div
        style={{
          position: "absolute",
          left: width * 0.06,
          right: width * 0.18,
          top: height * 0.18,
          maxHeight: height * 0.5,
          opacity,
          color: "#fff",
          fontSize: 88,
          lineHeight: 1.15,
          fontWeight: 700,
          textShadow: "0 6px 24px rgba(0,0,0,0.8)",
        }}
      >
        {scene.on_screen_text}
      </div>

      {/* Narration subtitle (low, but above safe zone) */}
      <div
        style={{
          position: "absolute",
          left: width * 0.06,
          right: width * 0.18,
          bottom: height * 0.24,
          opacity,
          color: "#cfe7ff",
          fontSize: 44,
          lineHeight: 1.3,
          textShadow: "0 4px 16px rgba(0,0,0,0.9)",
        }}
      >
        {scene.narration}
      </div>
    </AbsoluteFill>
  );
}

function BrandStrip() {
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        top: 40,
        padding: "10px 18px",
        borderRadius: 999,
        background: "rgba(7, 31, 50, 0.7)",
        border: "1px solid rgba(94, 234, 212, 0.4)",
        color: "#5eead4",
        fontSize: 28,
        fontWeight: 700,
      }}
    >
      SENTIX AI · LOGIC OVER SIGNAL
    </div>
  );
}
