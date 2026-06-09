import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataPath = path.resolve(__dirname, "../public/data.json");
const inputProps = fs.existsSync(dataPath)
  ? JSON.parse(fs.readFileSync(dataPath, "utf8"))
  : {};

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "main",
  inputProps,
});

const outputDir = path.resolve(__dirname, "../../out");
fs.mkdirSync(outputDir, { recursive: true });
const outputLocation = path.resolve(outputDir, "output.mp4");

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation,
  inputProps,
  concurrency: 1,
  timeoutInMilliseconds: 180000,
  chromiumOptions: { gl: "swiftshader" },
});

console.log("Rendered:", outputLocation);
