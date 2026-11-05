import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** One persistent highlight follows the active link on phones and desktop. */
export function NavigationMotion() {
  const marker = useRef<HTMLSpanElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const element = marker.current;
    const nav = element?.parentElement;
    if (!element || !nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLAnchorElement>('a.active');
      if (!active) {
        element.style.opacity = '0';
        return;
      }
      element.style.width = `${active.offsetWidth}px`;
      element.style.height = `${active.offsetHeight}px`;
      element.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      element.style.opacity = '1';
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    for (const link of nav.querySelectorAll('a')) observer.observe(link);
    return () => observer.disconnect();
  }, [pathname]);
  return <span ref={marker} className="nav-active-indicator" aria-hidden="true" />;
}
