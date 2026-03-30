import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Intercepts Android hardware back button (popstate event in WebView)
 * and routes it through React Router instead of letting the WebView
 * navigate away from the app (which causes white screen flash).
 */
export const useAndroidBack = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Push a sentinel state so there's always something to pop back to
    // without leaving the app
    window.history.pushState({ androidBack: true }, '');

    const handlePopState = (_e: PopStateEvent) => {
      // Re-push the sentinel so the back button always has a target
      window.history.pushState({ androidBack: true }, '');

      // Define which routes are "root" — pressing back here should minimize the app
      // not navigate further back (which would cause white screen)
      const rootRoutes = ['/', '/chat', '/chat/guest'];
      const isRoot = rootRoutes.includes(location.pathname);

      if (isRoot) {
        // On root routes, do nothing — let the OS handle minimize
        // We already re-pushed state so no white flash
        return;
      }

      // On non-root routes, navigate back within the app
      navigate(-1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate, location.pathname]);
};
