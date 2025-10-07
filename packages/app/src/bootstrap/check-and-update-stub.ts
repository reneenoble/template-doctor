// Ensures a base checkAndUpdateRepoUrl exists before the patch loader executes.
// Imported early from main.ts so that saml-batch-patch-loader sees a function immediately.
// This stub is lightweight and will be wrapped/enhanced later; real logic may overwrite it.
if (!(window as any).checkAndUpdateRepoUrl) {
  (window as any).checkAndUpdateRepoUrl = async function (u: string) {
    return u;
  };
  (window as any).__TD_BaseCheckAndUpdateRepoUrlStub = true;
  // Minimal debug (use debug-console.js if present)
  try {
    console.debug('[bootstrap] installed checkAndUpdateRepoUrl stub');
  } catch {}
}

export {}; // module marker
