import { useAndroidBack } from '@/hooks/useAndroidBack';

/**
 * Must be rendered inside BrowserRouter.
 * Intercepts Android hardware back button to prevent white screen flash
 * in WebView-based APKs (webintoapp, etc.)
 */
const AndroidBackHandler = () => {
  useAndroidBack();
  return null;
};

export default AndroidBackHandler;
