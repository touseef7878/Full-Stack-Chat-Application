import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSession } from '@/components/SessionContextProvider';
import { MessageCircle } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { supabase, session } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/chat');
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[hsl(var(--accent-primary))] flex-col items-center justify-center p-12 text-white">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight">Prochat</h1>
          <p className="text-white/80 text-lg leading-relaxed">
            Real-time conversations, public rooms, private messages — all in one place.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent-primary))] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">Prochat</span>
          </div>

          <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-8">Sign in to your account to continue</p>

          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(170, 80%, 40%)',
                    brandAccent: 'hsl(170, 80%, 32%)',
                    defaultButtonBackground: 'hsl(170, 80%, 40%)',
                    defaultButtonBackgroundHover: 'hsl(170, 80%, 32%)',
                    defaultButtonBorder: 'hsl(170, 80%, 40%)',
                    defaultButtonText: '#ffffff',
                    inputBackground: 'hsl(var(--background))',
                    inputBorder: 'hsl(var(--border))',
                    inputBorderHover: 'hsl(170, 80%, 40%)',
                    inputBorderFocus: 'hsl(170, 80%, 40%)',
                    inputText: 'hsl(var(--foreground))',
                    inputPlaceholder: 'hsl(var(--muted-foreground))',
                    anchorTextColor: 'hsl(170, 80%, 40%)',
                    anchorTextHoverColor: 'hsl(170, 80%, 32%)',
                    messageTextDanger: 'hsl(0, 84%, 60%)',
                  },
                  radii: {
                    buttonBorderRadius: '10px',
                    inputBorderRadius: '10px',
                  },
                  space: {
                    inputPadding: '12px 14px',
                    buttonPadding: '12px 16px',
                  },
                  fonts: {
                    bodyFontFamily: `'Inter', system-ui, sans-serif`,
                    buttonFontFamily: `'Inter', system-ui, sans-serif`,
                    inputFontFamily: `'Inter', system-ui, sans-serif`,
                  },
                  fontSizes: {
                    baseBodySize: '14px',
                    baseInputSize: '14px',
                    baseLabelSize: '13px',
                    baseButtonSize: '14px',
                  },
                },
              },
            }}
            view="sign_in"
          />

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[hsl(var(--accent-primary))] font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
