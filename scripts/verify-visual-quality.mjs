// Run against a development server; no ranking writes or external shares.
// PLAYWRIGHT_MODULE can point at a separately installed playwright package.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.argv[2] || "http://localhost:3000";
const output = process.argv[3] || "/tmp/mamonokiri-visual-quality";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const records = [];
const errors = [];
const page = await browser.newPage({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
page.on("pageerror", error => errors.push(error.message));
await page.route("**/*.supabase.co/**", route => route.abort());
await page.goto(url);
await page.waitForFunction(() => !!window.mamonokiriVisualProbe);
await page.evaluate(() => document.fonts.ready);
await page.locator("#player-name").fill("品質検査");
await page.screenshot({ path: `${output}/title-portrait.png` });
const targets = await page
  .locator(".title-screen button, .title-screen input, .title-advanced summary")
  .evaluateAll(nodes =>
    nodes
      .filter(
        e => e.getClientRects().length && getComputedStyle(e).display !== "none"
      )
      .map(e => {
        const r = e.getBoundingClientRect();
        return {
          text: e.textContent?.trim(),
          width: r.width,
          height: r.height,
        };
      })
  );
if (targets.some(t => t.width < 44 || t.height < 44))
  throw new Error("Title target below 44 CSS px");
records.push({ kind: "title-targets", targets });

for (const [width, height] of [
  [320, 568],
  [402, 874],
  [874, 402],
]) {
  await page.setViewportSize({ width, height });
  const settings = page.locator(".title-advanced");
  await settings.evaluate(e => (e.open = true));
  const visualHeight = await page
    .locator(".title-visual")
    .evaluate(e => e.getBoundingClientRect().height);
  if (visualHeight < 150) throw new Error("Title visual collapsed");
  // Browser layout and keyboard focus, not just DOM attribute presence.
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press("Tab");
    if (
      !(await page.evaluate(
        () => !!document.activeElement?.closest(".title-screen")
      ))
    )
      throw new Error("Modal focus escaped");
  }
  records.push({
    kind: "title",
    width,
    height,
    settingsOpen: true,
    visualHeight,
    focusContained: true,
  });
  await settings.evaluate(e => (e.open = false));
}
await page.setViewportSize({ width: 402, height: 874 });
// Simulate enlarged text while retaining the same CSS viewport.
await page.locator(".title-screen").evaluate(root => {
  const sizes = Array.from(root.querySelectorAll("*")).map(e => [
    e,
    parseFloat(getComputedStyle(e).fontSize),
  ]);
  sizes.forEach(([e, size]) => (e.style.fontSize = `${size * 2}px`));
});
const enlarged = await page.locator(".title-screen").evaluate(root => ({
  scrollHeight: root.scrollHeight,
  clientHeight: root.clientHeight,
  scrollWidth: root.scrollWidth,
  clientWidth: root.clientWidth,
  visualHeight: root.querySelector(".title-visual").getBoundingClientRect()
    .height,
}));
if (
  enlarged.scrollWidth > enlarged.clientWidth + 1 ||
  enlarged.visualHeight < 150
)
  throw new Error("Enlarged text layout clipped");
records.push({ kind: "enlarged-text", scale: 2, ...enlarged });
await page.screenshot({ path: `${output}/title-enlarged.png` });
await page.reload();
await page.waitForFunction(() => !!window.mamonokiriVisualProbe);
await page.getByRole("button", { name: "新しく始める", exact: true }).click();
await page.waitForTimeout(450);
await page.screenshot({ path: `${output}/combat-portrait.png` });
await page.getByRole("button", { name: "一時停止", exact: true }).click();
if (
  !(await page
    .getByRole("dialog", { name: "一時停止", exact: true })
    .isVisible())
)
  throw new Error("Pause did not open");
await page.keyboard.press("d");
await page.getByRole("button", { name: "再開", exact: true }).click();
await page.waitForFunction(() => !document.querySelector(".resume-progress"), {
  timeout: 3000,
});
for (const [name, expectedX] of [
  ["右へ回避", 0.9],
  ["左へ回避", -0.9],
]) {
  const button = page.getByRole("button", { name, exact: true });
  const r = await button.boundingBox();
  if (!r || r.width < 44 || r.height < 44)
    throw new Error("Combat target below 44 CSS px");
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(450);
  const snapshot = await page.evaluate(() =>
    window.mamonokiriVisualProbe.snapshot()
  );
  if (Math.abs(snapshot.playerPosition[0] - expectedX) > 0.001)
    throw new Error(`Tap direction mismatch: ${name}`);
  records.push({
    kind: "actual-touch",
    name,
    expectedX,
    actualX: snapshot.playerPosition[0],
    width: r.width,
    height: r.height,
  });
}
await page.getByRole("button", { name: "一時停止", exact: true }).click();
// Keep gameplay paused while sampling its actual production rig and camera.
await page.locator(".pause-overlay").evaluate(e => (e.style.display = "none"));
const names = [
  "影面",
  "角岩",
  "鳴壺",
  "逆鉾",
  "霧猿",
  "鉄輪",
  "骨灯",
  "牙嶺",
  "鎧熊",
  "沼喰",
  "百眼",
  "鬼将",
  "白面",
  "天狗鴉",
  "鶴骸",
  "石門王",
  "巨仏",
];
for (let i = 0; i < names.length; i++) {
  const name = names[i];
  await page.evaluate(
    ({ name }) =>
      window.mamonokiriVisualProbe.enemy(name, {
        time: 1000,
        lane: -1,
        windup: 0.8,
        strike: 0,
        recover: 0,
        attacking: true,
        followUp: true,
        phase: 2,
        staggered: false,
        defeated: false,
      }),
    { name }
  );
  await page.screenshot({
    path: `${output}/enemy-${String(i + 1).padStart(2, "0")}.jpg`,
    type: "jpeg",
    quality: 80,
  });
  records.push({
    kind: "enemy-sample",
    name,
    phase: 2,
    ...(await page.evaluate(() => window.mamonokiriVisualProbe.snapshot())),
  });
}
for (const name of names)
  for (const phase of [1, 2])
    for (const strike of [0, 0.5, 1]) {
      await page.evaluate(
        ({ name, phase, strike }) =>
          window.mamonokiriVisualProbe.enemy(name, {
            time: 1000,
            lane: 1,
            windup: 1,
            strike,
            recover: strike === 1 ? 0.6 : 0,
            attacking: true,
            followUp: strike < 1,
            phase,
            staggered: false,
            defeated: false,
          }),
        { name, phase, strike }
      );
      const snapshot = await page.evaluate(() =>
        window.mamonokiriVisualProbe.snapshot()
      );
      for (const actor of Object.values(snapshot.projectedBounds))
        if (
          actor.minX < 0 ||
          actor.maxX > 1 ||
          actor.minY < 0 ||
          actor.maxY > 1
        )
          throw new Error(`Actor cropped: ${name}/${phase}/${strike}`);
      records.push({
        kind: "enemy-phase-projection",
        name,
        phase,
        strike,
        ...snapshot,
      });
    }
for (const chapter of [1, 2, 3, 4, 5]) {
  await page.evaluate(
    chapter => window.mamonokiriVisualProbe.chapter(chapter),
    chapter
  );
  await page.screenshot({
    path: `${output}/chapter-${chapter}.jpg`,
    type: "jpeg",
    quality: 80,
  });
}
for (const tier of ["high", "lite"])
  for (const [width, height] of [
    [402, 874],
    [874, 402],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(
      tier =>
        window.dispatchEvent(
          new CustomEvent("yamabushi-performance", { detail: { tier } })
        ),
      tier
    );
    await page.evaluate(() =>
      window.mamonokiriVisualProbe.player({
        kind: "guard",
        progress: 1,
        timeSeconds: 2,
        direction: 1,
      })
    );
    await page.screenshot({
      path: `${output}/guard-${tier}-${width}.jpg`,
      type: "jpeg",
      quality: 80,
    });
    records.push({
      kind: "quality-viewport",
      width,
      height,
      tier,
      ...(await page.evaluate(() => window.mamonokiriVisualProbe.snapshot())),
    });
  }
await page.emulateMedia({ reducedMotion: "reduce" });
await page.evaluate(() =>
  window.mamonokiriVisualProbe.player({
    kind: "attack",
    attackKind: "counter",
    progress: 90 / 440,
    timeSeconds: 0.09,
    reducedMotion: true,
  })
);
records.push({
  kind: "reduced-motion",
  setting: "OS reduce",
  ...(await page.evaluate(() => window.mamonokiriVisualProbe.snapshot())),
});
const contextLossAvailable = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  const extension = gl?.getExtension("WEBGL_lose_context");
  if (!extension) return false;
  window.qualityRestoreContext = () => extension.restoreContext();
  extension.loseContext();
  return true;
});
if (contextLossAvailable) {
  await page.waitForFunction(() =>
    document.querySelector(".scene-status")?.textContent.includes("中断")
  );
  await page.waitForTimeout(150);
  await page.evaluate(() => window.qualityRestoreContext());
  await page.waitForFunction(
    () =>
      document.querySelector(".title-screen > .result-primary")?.disabled ===
      false
  );
  records.push({
    kind: "context-loss",
    restored: true,
    titleUsable: true,
    manualResumeRequired: true,
  });
} else
  records.push({
    kind: "context-loss",
    result: "blocked",
    reason: "WEBGL_lose_context unavailable",
  });
const evidence = {
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  lockHash: execFileSync("sha256sum", ["pnpm-lock.yaml"], {
    encoding: "utf8",
  }).split(" ")[0],
  browser: await browser.version(),
  renderer: "Chromium SwiftShader (software GPU)",
  dpr: 1,
  records,
  errors,
  limitations: [
    "Not an iPhone/Safari/VoiceOver or touch ergonomics test",
    "CPU is measured; GPU duration is unavailable",
    "Paused diagnostic samples do not establish continuous-play quality",
    "No live ranking writes or shares performed",
    "30 minute hardware/thermal run not performed",
  ],
};
await writeFile(
  `${output}/browser-evidence.json`,
  JSON.stringify(evidence, null, 2) + "\n"
);
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(JSON.stringify({ output, records: records.length, errors }));
