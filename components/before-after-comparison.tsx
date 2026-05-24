"use client";

import { useMemo, useState } from "react";

type BeforeAfterComparisonProps = {
  beforeSrc: string;
  afterSrc: string;
};

export function BeforeAfterComparison({
  beforeSrc,
  afterSrc,
}: BeforeAfterComparisonProps) {
  const [sliderValue, setSliderValue] = useState(50);

  const clipPath = useMemo(
    () => `inset(0 ${100 - sliderValue}% 0 0)`,
    [sliderValue],
  );

  return (
    <section className="w-full space-y-4" aria-label="Before and after wall comparison">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-white/30 bg-white/70 p-3 shadow-lg backdrop-blur">
          <h3 className="text-sm font-semibold text-slate-700">Original Wall</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeSrc}
            alt="Original uploaded wall"
            className="h-56 w-full rounded-xl object-cover md:h-72"
          />
        </div>
        <div className="space-y-2 rounded-2xl border border-white/30 bg-white/70 p-3 shadow-lg backdrop-blur">
          <h3 className="text-sm font-semibold text-slate-700">Decorated Wall</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterSrc}
            alt="AI decorated wall preview"
            className="h-56 w-full rounded-xl object-cover md:h-72"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/30 bg-white/70 p-4 shadow-lg backdrop-blur">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Interactive Compare</h3>
        <div className="relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeSrc}
            alt="Original wall for slider comparison"
            className="h-64 w-full object-cover md:h-96"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterSrc}
            alt="Decorated wall for slider comparison"
            className="absolute inset-0 h-64 w-full object-cover md:h-96"
            style={{ clipPath }}
          />
        </div>
        <label htmlFor="comparison-slider" className="mt-4 block text-sm text-slate-700">
          Compare slider: {sliderValue}%
        </label>
        <input
          id="comparison-slider"
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          onChange={(event) => setSliderValue(Number(event.target.value))}
          className="mt-2 w-full accent-cyan-600"
        />
      </div>
    </section>
  );
}
