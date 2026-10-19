import { beforeEach, describe, expect, it, vi } from "vitest";

const cue = vi.fn();
vi.mock("cuelume", () => ({ play: cue, setVolume: vi.fn() }));
vi.mock("react", () => ({ useSyncExternalStore: vi.fn() }));

const store = new Map<string, string>();
let reduced = false;
// Minimal browser: a window with AudioContext, localStorage and matchMedia (node env, no jsdom).
async function load(audio = true) {
  const win = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: reduced }), ...(audio ? { AudioContext: class {} } : {}) });
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { webdriver: false });
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.resetModules();
  return { win, s: await import("./sound") };
}
const tick = () => new Promise((r) => setTimeout(r, 10));
beforeEach(() => { cue.mockClear(); store.clear(); reduced = false; });

describe("sound", () => {
  it("is silent before a gesture, then plays the cue once", async () => {
    const { win, s } = await load();
    s.play("success"); await tick();
    expect(cue).not.toHaveBeenCalled();
    win.dispatchEvent(new Event("pointerdown"));
    s.play("success");
    await vi.waitFor(() => expect(cue).toHaveBeenCalledTimes(1));
    expect(cue).toHaveBeenCalledWith("success", undefined);
  });
  it("mute persists across reloads and silences", async () => {
    const a = await load();
    a.win.dispatchEvent(new Event("keydown"));
    a.s.setSoundOn(false);
    const b = await load();
    b.win.dispatchEvent(new Event("keydown"));
    expect(b.s.soundOn()).toBe(false);
    b.s.play("error"); await tick();
    expect(cue).not.toHaveBeenCalled();
  });
  it("defaults off for reduced motion", async () => {
    reduced = true;
    expect((await load()).s.soundOn()).toBe(false);
  });
  it("does nothing, without throwing, when AudioContext is missing", async () => {
    const { win, s } = await load(false);
    win.dispatchEvent(new Event("pointerdown"));
    expect(() => s.play("tap")).not.toThrow(); await tick();
    expect(cue).not.toHaveBeenCalled();
  });
});
