import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSession } from '@/components/SessionContextProvider';
import { MessageCircle, Zap, Shield, Users } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const { supabase, session } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/chat');
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[hsl(var(--accent-primary))] flex-col items-center justify-center p-12 text-white">
        <div className="max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight">Join Prochat</h1>
          <p className="text-white/80 text-lg leading-relaxed mb-8">
            Create your free account and start chatting in seconds.
          </p>
          <div className="space-y-4">
            {[
              { icon: Zap, text: 'Real-time messaging' },
              { icon: Shield, text: 'Private & secure DMs' },
              { icon: Users, text: 'Public chat rooms' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/90">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
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

          <h2 className="text-2xl font-bold mb-1">Create account</h2>
          <p className="text-muted-foreground text-sm mb-8">Free forever. No credit card required.</p>

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
            view="sign_up"
          />

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[hsl(var(--accent-primary))] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
