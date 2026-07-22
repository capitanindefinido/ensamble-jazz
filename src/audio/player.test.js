import { describe, expect, it } from "vitest";
import { parseChart, EAST_OF_SUN_CHART, parseChord } from "../chart/parse.js";
import {
  bassMidiForBeat,
  chordTones,
  chordsForBeats,
  flattenMeasures,
  measureBeatTimes,
  secondsPerBeat,
  voicingMidis,
} from "./player.js";

describe("ChartPlayer — helpers", () => {
  it("aplana el AST en orden global de índices", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    const flat = flattenMeasures(ast);
    expect(flat.length).toBeGreaterThan(0);
    expect(flat[0].index).toBe(0);
    for (let i = 1; i < flat.length; i++) {
      expect(flat[i].index).toBe(flat[i - 1].index + 1);
    }
  });

  it("reparte dos acordes entre los beats del compás", () => {
    const measure = {
      chords: [parseChord("Ah7"), parseChord("D7b13")],
    };
    const beats = chordsForBeats(measure, 4);
    expect(beats[0].quality).toBe("halfdim");
    expect(beats[1].quality).toBe("halfdim");
    expect(beats[2].quality).toBe("dom");
    expect(beats[3].quality).toBe("dom");
  });

  it("% ya trae acordes copiados — el player los usa", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    const flat = flattenMeasures(ast);
    const pct = flat.find((m) => m.repeatPrev);
    expect(pct).toBeTruthy();
    expect(pct.chords.length).toBeGreaterThan(0);
    const tones = chordTones(pct.chords[0]);
    expect(tones).toBeTruthy();
  });

  it("bajo camina fund–5ta–fund–5ta", () => {
    const chord = parseChord("C-7");
    const m0 = bassMidiForBeat(chord, 0);
    const m1 = bassMidiForBeat(chord, 1);
    const m2 = bassMidiForBeat(chord, 2);
    const m3 = bassMidiForBeat(chord, 3);
    expect(m0).toBe(m2);
    expect(m1).toBe(m3);
    expect(m0).not.toBe(m1);
    // C y G: diferencia de 7 semitonos
    expect(Math.abs(m1 - m0) % 12).toBe(7);
  });

  it("voicing maj7 usa 3ra mayor y 7ma mayor", () => {
    const chord = parseChord("Bb^7");
    const v = voicingMidis(chord);
    const tones = chordTones(chord);
    expect(v.third % 12).toBe(tones.thirdPc);
    expect(v.seventh % 12).toBe(tones.seventhPc);
  });
});

describe("negras siempre a 60/bpm (sin “swing” en el pulso)", () => {
  it.each(["Medium Swing", "Ballad Swing", "Bossa"])(
    "feel %s: beats consecutivos separados por exactamente 60/bpm",
    (feel) => {
      const bpm = 70;
      const spb = secondsPerBeat(bpm);
      expect(spb).toBeCloseTo(60 / 70, 12);

      const times = measureBeatTimes(bpm, 4, feel, 0);
      expect(times).toHaveLength(4);
      for (let i = 1; i < times.length; i++) {
        expect(times[i] - times[i - 1]).toBeCloseTo(spb, 12);
      }
      // Misma grilla que sin feel: el feel no debe mover nada
      expect(times).toEqual(measureBeatTimes(bpm, 4, "", 0));
    }
  );
});
