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
import { loadFont as loadDisplay } from "@remotion/google-fonts/BebasNeue";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"] });
const { fontFamily: displayFamily } = loadDisplay("normal", { weights: ["400"] });

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

type Caption = { text: string; start: number; end: number };

type Props = {
  title: string;
  full_script: string;
  music_mood?: string;
  scenes: Scene[];
  asset_plan?: AssetPick[];
  audio_url?: string | null;
  captions?: Caption[];
  end_card?: { tagline?: string; brand?: string };
};

const FPS = 30;
const END_CARD_SEC = 2.5;

export const MainVideo: React.FC<Props> = (props) => {
  const { scenes, asset_plan, audio_url, captions, end_card } = props;
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070d", fontFamily }}>
      <BackgroundLayer />

      {/* Per-scene clips with Ken Burns + crossfade */}
      {scenes?.map((s, i) => {
        const from = Math.round(s.start_sec * FPS);
        const dur = Math.max(15, Math.round((s.end_sec - s.start_sec) * FPS));
        const asset = asset_plan?.find((a) => Math.abs(a.start_sec - s.start_sec) < 0.1) ?? asset_plan?.[i];
        return (
          <Sequence key={i} from={from} durationInFrames={dur + 8} layout="none">
            <SceneRender scene={s} asset={asset} sceneIndex={i} />
          </Sequence>
        );
      })}

      {/* Animated bottom captions (word-sync) */}
      {captions && captions.length > 0 && <AnimatedCaptions captions={captions} />}

      {/* Headline (kinetic typography) for first scene */}
      {scenes?.[0] && <KineticHeadline text={scenes[0].on_screen_text} />}

      {/* Brand watermark */}
      <BrandStrip />

      {/* End card last N seconds */}
      <Sequence from={Math.max(0, durationInFrames - END_CARD_SEC * FPS)}>
        <EndCard tagline={end_card?.tagline ?? "Logic over Signal"} brand={end_card?.brand ?? "SENTIX AI"} />
      </Sequence>

      {audio_url && (
        <Audio src={audio_url.startsWith("http") ? audio_url : staticFile(audio_url)} />
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

function SceneRender({ scene, asset, sceneIndex }: { scene: Scene; asset?: AssetPick; sceneIndex: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Crossfade in/out 8 frames each
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Ken Burns: alternate zoom-in / pan-direction by scene index
  const t = frame / Math.max(1, durationInFrames);
  const zoomFrom = sceneIndex % 2 === 0 ? 1.08 : 1.18;
  const zoomTo = sceneIndex % 2 === 0 ? 1.22 : 1.04;
  const scale = interpolate(t, [0, 1], [zoomFrom, zoomTo]);
  const panX = (sceneIndex % 2 === 0 ? 1 : -1) * interpolate(t, [0, 1], [-2, 2]);
  const panY = interpolate(t, [0, 1], [sceneIndex % 3 === 0 ? -1.5 : 1.5, 0]);

  const isVideo = asset?.chosen?.url?.match(/\.(mp4|webm|mov)(\?|$)/i);
  const rawUrl = asset?.chosen?.url;
  const assetSrc = rawUrl
    ? (rawUrl.startsWith("http") ? rawUrl : staticFile(rawUrl))
    : undefined;

  // Spring entrance for layered card animation
  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      {assetSrc && isVideo && (
        <AbsoluteFill style={{ transform: `scale(${scale}) translate(${panX}%, ${panY}%)` }}>
          <Video
            src={assetSrc}
            muted
            startFrom={0}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.15) contrast(1.1) brightness(0.92)" }}
          />
        </AbsoluteFill>
      )}
      {assetSrc && !isVideo && (
        <AbsoluteFill style={{ transform: `scale(${scale}) translate(${panX}%, ${panY}%)` }}>
          <Img
            src={assetSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.1) contrast(1.05)" }}
          />
        </AbsoluteFill>
      )}

      {/* Top + bottom gradient overlays for caption readability without darkening the middle */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Scene chip top-right (subtle scene marker) */}
      <div
        style={{
          position: "absolute",
          right: 36,
          top: 36,
          padding: "8px 16px",
          borderRadius: 999,
          background: "rgba(11,18,32,0.55)",
          border: "1px solid rgba(94,234,212,0.25)",
          color: "#9ee9d8",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1,
          transform: `translateY(${interpolate(enter, [0, 1], [-30, 0])}px)`,
          opacity: enter,
        }}
      >
        {String(sceneIndex + 1).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
}

function KineticHeadline({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // Only animate first ~3.5 seconds
  const totalDur = Math.round(3.5 * fps);
  if (frame > totalDur + fps) return null;

  const visible = interpolate(frame, [totalDur, totalDur + fps], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Split into words for staggered entry
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div
      style={{
        position: "absolute",
        left: width * 0.06,
        right: width * 0.06,
        top: height * 0.14,
        opacity: visible,
        color: "#fff",
        fontSize: 92,
        lineHeight: 1.08,
        fontWeight: 700,
        textShadow: "0 8px 32px rgba(0,0,0,0.85), 0 0 28px rgba(94,234,212,0.18)",
        display: "flex",
        flexWrap: "wrap",
        gap: "0 22px",
      }}
    >
      {words.map((w, i) => {
        const delay = i * 3;
        const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });
        const blur = interpolate(s, [0, 1], [18, 0]);
        const y = interpolate(s, [0, 1], [40, 0]);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: s,
              filter: `blur(${blur}px)`,
              transform: `translateY(${y}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
      {/* Accent underline */}
      <div
        style={{
          width: `${interpolate(frame, [10, 40], [0, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
          height: 6,
          marginTop: 18,
          borderRadius: 4,
          background: "linear-gradient(90deg, #5eead4 0%, #38bdf8 100%)",
          boxShadow: "0 0 24px rgba(94,234,212,0.55)",
        }}
      />
    </div>
  );
}

function AnimatedCaptions({ captions }: { captions: Caption[] }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const tNow = frame / fps;

  // Group captions into short chunks (~6-8 words / ~3s windows) to render 1-2 line phrases.
  // Pick the chunk that contains tNow.
  const chunkSize = 7;
  const chunks: Caption[][] = [];
  for (let i = 0; i < captions.length; i += chunkSize) chunks.push(captions.slice(i, i + chunkSize));

  const active = chunks.find((c) => tNow >= c[0].start - 0.05 && tNow <= c[c.length - 1].end + 0.2);
  if (!active) return null;

  // Slide-up + fade pill
  const chunkFrame = Math.round((tNow - active[0].start) * fps);
  const enter = spring({ frame: chunkFrame, fps, config: { damping: 24, stiffness: 200 } });
  const y = interpolate(enter, [0, 1], [40, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: width * 0.05,
        right: width * 0.05,
        bottom: height * 0.08,
        display: "flex",
        justifyContent: "center",
        opacity: enter,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          maxWidth: "92%",
          padding: "22px 34px",
          borderRadius: 24,
          background: "rgba(8, 12, 22, 0.78)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
          textAlign: "center",
          fontSize: 54,
          fontWeight: 700,
          lineHeight: 1.25,
          color: "#fff",
          letterSpacing: 0.2,
          display: "flex",
          flexWrap: "wrap",
          gap: "0 14px",
          justifyContent: "center",
        }}
      >
        {active.map((w, i) => {
          const isActive = tNow >= w.start - 0.02 && tNow <= w.end + 0.06;
          const past = tNow > w.end;
          const wordFrame = Math.round((tNow - w.start) * fps);
          const pop = isActive ? spring({ frame: wordFrame, fps, config: { damping: 12, stiffness: 220 } }) : 1;
          const scale = isActive ? interpolate(pop, [0, 1], [1, 1.12]) : 1;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: isActive ? "#FFD166" : past ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                transform: `scale(${scale})`,
                transition: "none",
                textShadow: isActive ? "0 0 18px rgba(255,209,102,0.55)" : "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EndCard({ tagline, brand }: { tagline: string; brand: string }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s1 = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
  const s2 = spring({ frame: frame - 12, fps, config: { damping: 16, stiffness: 140 } });
  const shimmer = interpolate(frame, [0, 90], [-200, 200]);

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 50%, #0e3a5f 0%, #05070d 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: displayFamily,
          fontSize: 160,
          letterSpacing: 8,
          color: "#5eead4",
          opacity: s1,
          transform: `scale(${interpolate(s1, [0, 1], [0.7, 1])})`,
          textShadow: "0 0 40px rgba(94,234,212,0.5)",
          position: "relative",
        }}
      >
        {brand}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)`,
            transform: `translateX(${shimmer}%)`,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        style={{
          marginTop: 24,
          color: "#cfe7ff",
          fontSize: 56,
          fontWeight: 700,
          opacity: s2,
          transform: `translateY(${interpolate(s2, [0, 1], [30, 0])}px)`,
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          marginTop: 36,
          padding: "16px 32px",
          borderRadius: 999,
          background: "linear-gradient(90deg, #5eead4, #38bdf8)",
          color: "#05070d",
          fontSize: 38,
          fontWeight: 700,
          opacity: s2,
          boxShadow: "0 0 40px rgba(94,234,212,0.4)",
        }}
      >
        sentixai4.xo.je
      </div>
    </AbsoluteFill>
  );
}

function BrandStrip() {
  return (
    <div
      style={{
        position: "absolute",
        left: 36,
        top: 36,
        padding: "10px 18px",
        borderRadius: 999,
        background: "rgba(7, 31, 50, 0.65)",
        border: "1px solid rgba(94, 234, 212, 0.4)",
        color: "#5eead4",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 1.5,
      }}
    >
      SENTIX AI
    </div>
  );
}
