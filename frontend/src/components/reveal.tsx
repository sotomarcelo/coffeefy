"use client";

import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";

type RevealProps<T extends ElementType = "div"> = {
  as?: T;
  className?: string;
  delay?: number;
  children: React.ReactNode;
} & ComponentPropsWithoutRef<T>;

export function Reveal<T extends ElementType = "div">({
  as,
  className = "",
  delay = 0,
  children,
  style,
  ...rest
}: RevealProps<T>) {
  const Component = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldReduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (shouldReduceMotion) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const mergedStyle: CSSProperties = {
    ...style,
    "--reveal-delay": `${delay}ms`,
  } as CSSProperties;

  return (
    <Component
      {...(rest as ComponentPropsWithoutRef<ElementType>)}
      ref={ref as unknown as MutableRefObject<HTMLElement | null>}
      className={className}
      data-reveal={visible ? "show" : "hide"}
      style={mergedStyle}
    >
      {children}
    </Component>
  );
}
