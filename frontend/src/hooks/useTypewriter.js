import { useState, useEffect, useRef } from "react";

/**
 * Hook that reveals `text` character-by-character.
 * Returns the currently-visible substring.
 *
 * @param {string} text        – full text to type
 * @param {number} speed       – ms per character (default 12)
 * @param {boolean} enabled    – set false to show full text instantly
 */
export function useTypewriter(text, speed = 12, enabled = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    if (!text) { setDisplayed(""); setDone(true); return; }
    if (!enabled) { setDisplayed(text); setDone(true); return; }

    idx.current = 0;
    setDisplayed("");
    setDone(false);

    const timer = setInterval(() => {
      idx.current += 1;
      const chunk = text.slice(0, idx.current);
      setDisplayed(chunk);
      if (idx.current >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, enabled]);

  const skip = () => { setDisplayed(text || ""); setDone(true); };

  return { displayed, done, skip };
}
