"use client";

import { useState } from "react";

export function HoursField() {
  const [slider, setSlider] = useState(0);
  const [custom, setCustom] = useState("");
  const customHours = Number(custom);
  const hours = slider >= 1000 && customHours > 1000 ? customHours : slider;

  return (
    <div className="field wide">
      <span>Estimated hours</span>
      <div className="hours-slider">
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.min(slider, 1000)}
          aria-label="Estimated hours"
          onChange={(event) => setSlider(Number(event.target.value))}
        />
        <output>{hours}</output>
      </div>
      {slider >= 1000 ? (
        <label className="field">
          <span>Custom estimated hours</span>
          <input
            type="number"
            min={1001}
            step={1}
            value={custom}
            placeholder="Hours above 1,000"
            onChange={(event) => setCustom(event.target.value)}
          />
        </label>
      ) : null}
      <input type="hidden" name="estimatedHours" value={hours} />
    </div>
  );
}
