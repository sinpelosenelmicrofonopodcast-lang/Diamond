"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Slide = {
  src: string;
  alt: string;
};

export function DiamondSlideshow({ slides }: { slides: Slide[] }) {
  const usableSlides = useMemo(() => slides.filter((item) => Boolean(item.src)), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (usableSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % usableSlides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [usableSlides.length]);

  if (usableSlides.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center rounded-3xl border border-silver/20 bg-black/40 text-sm text-coolSilver">
        No gallery photos yet.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-3xl border border-gold/20 bg-black">
      {usableSlides.map((slide, index) => (
        <div
          key={`${slide.src}-${index}`}
          className={`absolute inset-0 transition-opacity duration-700 ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
        >
          <Image src={slide.src} alt={slide.alt} fill className="object-cover" />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
      <div className="absolute bottom-3 left-3 flex gap-1.5">
        {usableSlides.map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-6 rounded-full ${index === activeIndex ? "bg-softGold" : "bg-silver/40"}`}
          />
        ))}
      </div>
    </div>
  );
}
