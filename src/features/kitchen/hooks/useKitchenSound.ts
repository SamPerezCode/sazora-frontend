import { useCallback, useEffect, useRef, useState } from "react";

export function useKitchenSound(userKey: string) {
  const storageKey = "sazora:kitchen-sound:" + userKey;

  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "on";
    } catch {
      return false;
    }
  });

  const [error, setError] = useState("");
  const context = useRef<AudioContext | null>(null);
  const active = useRef(false);
  const preferred = useRef(enabled);
  const mounted = useRef(false);
  const last = useRef(0);

  useEffect(() => {
    let live = true;
    mounted.current = true;
    active.current = false;

    async function unlock() {
      if (!preferred.current || !live) return;

      try {
        const audio = context.current ?? new AudioContext();
        context.current = audio;

        await audio.resume();

        if (!live) return;

        active.current = audio.state === "running";

        setError(
          active.current
            ? ""
            : "Pulsa Sonido para habilitar el audio."
        );
      } catch {
        if (live) {
          setError("El navegador no permitió activar el sonido.");
        }
      }
    }

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      live = false;
      mounted.current = false;
      active.current = false;

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);

      const audio = context.current;
      context.current = null;

      if (audio) void audio.close().catch(() => {});
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
    const next = !preferred.current;

    preferred.current = next;
    active.current = false;
    setEnabled(next);
    setError("");

    try {
      localStorage.setItem(storageKey, next ? "on" : "off");
    } catch {
      // La preferencia sigue disponible durante esta sesión.
    }

    if (!next) return;

    try {
      const audio = context.current ?? new AudioContext();
      context.current = audio;

      await audio.resume();

      if (
        mounted.current &&
        preferred.current &&
        context.current === audio
      ) {
        active.current = audio.state === "running";
      }
    } catch {
      if (mounted.current) {
        setError("El navegador no permitió activar el sonido.");
      }
    }
  }

  return { enabled, error, play, toggle };
}
