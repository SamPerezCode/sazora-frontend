import { useCallback, useEffect, useRef, useState } from "react";

export function useKitchenSound() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");

  const context = useRef<AudioContext | null>(null);
  const active = useRef(false);
  const last = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      active.current = false;

      if (context.current) {
        void context.current.close().catch(() => {});
      }

      context.current = null;
    };
  }, []);

  const play = useCallback((kind: "new" | "cancel") => {
    const audio = context.current;

    if (
      !active.current ||
      !audio ||
      audio.state !== "running" ||
      Date.now() - last.current < 500
    ) {
      return;
    }

    last.current = Date.now();

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.frequency.value = kind === "cancel" ? 330 : 880;

    gain.gain.setValueAtTime(0.12, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + 0.25
    );

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.25);
  }, []);

  async function toggle() {
    if (active.current) {
      active.current = false;
      setEnabled(false);
      return;
    }

    try {
      if (!context.current) {
        context.current = new AudioContext();
      }

      await context.current.resume();

      if (!mounted.current) return;

      active.current = true;
      setEnabled(true);
      setError("");

      play("new");
    } catch {
      if (mounted.current) {
        setError("El navegador no permitió activar el sonido.");
      }
    }
  }

  return { enabled, error, play, toggle };
}
