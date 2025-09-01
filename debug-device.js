console.log("🔍 DEBUG - User Agent:", navigator.userAgent);
console.log("🔍 DEBUG - Screen:", window.screen.width, "x", window.screen.height);
console.log("🔍 DEBUG - Standalone:", window.matchMedia("(display-mode: standalone)").matches);
console.log("🔍 DEBUG - Navigator standalone:", (window.navigator as any).standalone);
