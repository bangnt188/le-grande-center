"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function ScrollMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const lenis = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      syncTouch: false,
    });
    const updateScrollTrigger = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", updateScrollTrigger);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", updateScrollTrigger);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = gsap.utils.toArray<HTMLElement>(
      "#main-content > section, #main-content > div > section, #main-content > div > h1, #main-content > div > p",
    );
    const context = gsap.context(() => {
      targets.forEach((target) => {
        const parts = Array.from(target.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement,
        );
        gsap.fromTo(
          parts.length ? parts : target,
          { autoAlpha: 0, y: 26 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.85,
            ease: "expo.out",
            stagger: parts.length > 1 ? 0.11 : 0,
            clearProps: "transform,opacity,visibility",
            scrollTrigger: {
              trigger: target,
              start: "top 86%",
              once: true,
            },
          },
        );
      });
    });
    ScrollTrigger.refresh();

    return () => context.revert();
  }, [pathname]);

  return null;
}
