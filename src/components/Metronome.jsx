import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  LookaheadScheduler,
  playClick,
  resumeAudioContext,
} from "../audio/scheduler.js";

const BEATS_PER_BAR = 4;

export default function Metronome({ bpm }) {
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const beatsRef = useRef(null);

  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const schedulerRef = useRef(null);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    schedulerRef.current = new LookaheadScheduler();
    return () => {
      schedulerRef.current?.stop();
      schedulerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    if (!playing) {
      scheduler.stop();
      currentBeatRef.current = 0;
      setBeat(0);
      return;
    }

    let cancelled = false;
    currentBeatRef.current = 0;

    resumeAudioContext().then((audioCtx) => {
      if (cancelled || !audioCtx || !schedulerRef.current) return;
      nextNoteTimeRef.current = audioCtx.currentTime + 0.05;

      scheduler.start(({ ctx, now, scheduleAheadSec, scheduleVisual }) => {
        const tempo = bpmRef.current;
        const secondsPerBeat = 60.0 / tempo;

        while (nextNoteTimeRef.current < now + scheduleAheadSec) {
          const beatNum = currentBeatRef.current;
          const when = nextNoteTimeRef.current;
          const isDownbeat = beatNum % BEATS_PER_BAR === 0;

          playClick(ctx, when, isDownbeat);
          scheduleVisual(when, () => setBeat(beatNum));

          nextNoteTimeRef.current += secondsPerBeat;
          currentBeatRef.current = (beatNum + 1) % BEATS_PER_BAR;
        }
      });
    });

    return () => {
      cancelled = true;
      scheduler.stop();
    };
  }, [playing]);

  const toggle = async () => {
    if (!playing) {
      await resumeAudioContext();
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
