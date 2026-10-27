/* AdMob banner at the top of the screen (Android app only).
 * The game area moves down by the banner's height so nothing is hidden behind it.
 * In a normal browser a grey placeholder shows where the banner will be. */
(function () {
  'use strict';
  const cfg = window.CIRCUS_ADS || {};
  const setAdHeight = h => {
    document.documentElement.style.setProperty('--ad-h', Math.round(h || 0) + 'px');
    window.dispatchEvent(new Event('resize'));
  };
  // Native banner: reserve room immediately (before the ad reports its real size) and add a
  // safety margin, so the banner can never sit on top of buttons.
  const SAFETY = 28;
  let seen = 0;
  const reserve = h => { seen = Math.max(seen, h || 0); setAdHeight(Math.max(seen, 60) + SAFETY); };
  const C = window.Capacitor;
  const isNative = !!(C && C.isNativePlatform && C.isNativePlatform());

  if (!isNative) {
    const ph = document.getElementById('adph');
    if (ph) { ph.hidden = false; setAdHeight(50); }
    return;
  }

  const reg = (window.capacitorExports && window.capacitorExports.registerPlugin) || C.registerPlugin;
  const AdMob = (C.Plugins && C.Plugins.AdMob) || (reg && reg('AdMob'));
  if (!AdMob || !cfg.bannerId) return;
  // Google's sample banner id for test builds (never counts as a real impression)
  const adId = cfg.testing ? 'ca-app-pub-3940256099942544/9214589741' : cfg.bannerId;

  reserve(0);
  try {
    AdMob.addListener('bannerAdSizeChanged', size => reserve(size && size.height));
    AdMob.addListener('bannerAdLoaded', () => reserve(0));
  } catch (e) { /* ignore */ }
  (async () => {
    try {
      await AdMob.initialize({
        initializeForTesting: !!cfg.testing,
        tagForChildDirectedTreatment: !!cfg.childDirected,
        tagForUnderAgeOfConsent: !!cfg.childDirected,
        maxAdContentRating: cfg.childDirected ? 'General' : undefined
      });
    } catch (e) { /* keep going */ }
    try { // Google consent form (only shows where the law requires it, e.g. EU)
      const info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: !!cfg.childDirected });
      if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
    } catch (e) { /* ignore */ }
    const show = async () => {
      try {
        await AdMob.showBanner({
          adId,
          adSize: 'ADAPTIVE_BANNER',
          position: 'TOP_CENTER',
          margin: 0,
          isTesting: !!cfg.testing,
          npa: !!cfg.childDirected,          // non-personalized ads for a kids audience
          immersiveMode: true
        });
      } catch (e) { retry(); }
    };
    // If no ad is available right now, ask again every 30s instead of waiting for the next refresh
    let retryT = null;
    const retry = () => { clearTimeout(retryT); retryT = setTimeout(show, 30000); };
    try { AdMob.addListener('bannerAdFailedToLoad', retry); } catch (e) { /* ignore */ }
    try { AdMob.addListener('bannerAdLoaded', () => clearTimeout(retryT)); } catch (e) { /* ignore */ }
    show();
  })();
})();
