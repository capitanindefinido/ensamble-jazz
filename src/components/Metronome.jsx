import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Metrónomo con scheduler lookahead sobre AudioContext.currentTime
 * ("A Tale of Two Clocks"). setInterval solo despierta el scheduler;
 * el timing de los clicks lo marca el audio clock.
 */
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;
const BEATS_PER_BAR = 4;

let sharedCtx = null;

function getAudioContext() {
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function playClick(ctx, time, isDownbeat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.setValueAtTime(isDownbeat ? 1000 : 800, time);
  osc.type = "square";

  const peak = isDownbeat ? 0.28 : 0.14;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

  osc.start(time);
  osc.stop(time + 0.055);
}

export default function Metronome({ bpm }) {
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const beatsRef = useRef(null);

  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const timerRef = useRef(null);
  const visualTimersRef = useRef([]);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    if (!playing) {
      currentBeatRef.current = 0;
      setBeat(0);
      return;
    }

    const ctx = getAudioContext();
    currentBeatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;

    const schedule = () => {
      const tempo = bpmRef.current;
      const secondsPerBeat = 60.0 / tempo;

      while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
        const beatNum = currentBeatRef.current;
        const when = nextNoteTimeRef.current;
        const isDownbeat = beatNum % BEATS_PER_BAR === 0;

        playClick(ctx, when, isDownbeat);

        const delayMs = Math.max(0, (when - ctx.currentTime) * 1000);
        const tid = window.setTimeout(() => {
          setBeat(beatNum);
          visualTimersRef.current = visualTimersRef.current.filter(
            (id) => id !== tid
          );
        }, delayMs);
        visualTimersRef.current.push(tid);

        nextNoteTimeRef.current += secondsPerBeat;
        currentBeatRef.current = (beatNum + 1) % BEATS_PER_BAR;
      }
    };

    schedule();
    timerRef.current = window.setInterval(schedule, LOOKAHEAD_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      visualTimersRef.current.forEach(clearTimeout);
      visualTimersRef.current = [];
    };
  }, [playing]);

  const toggle = async () => {
    if (!playing) {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  };

  return (
    <div className="be-metro">
      <button
        className="be-metro-btn"
        onClick={toggle}
        aria-label={playing ? "Detener tempo" : "Escuchar tempo"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
        <span>{bpm} bpm</span>
      </button>
      <div className="be-beats" ref={beatsRef}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              "be-beat" +
              (playing && beat === i ? (i === 0 ? " on down" : " on") : "")
            }
          />
        ))}
      </div>
    </div>
  );
}
