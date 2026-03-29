"use client";

import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { MessageCircle, Zap, Shield, Users, ArrowRight, Globe } from 'lucide-react';

const Index: React.FC = () => {
  const { session, loginAsGuest } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/chat');
  }, [session, navigate]);

  const handleGuestLogin = React.useCallback(async () => {
    await loginAsGuest();
    navigate('/chat/guest');
  }, [loginAsGuest, navigate]);

  if (session) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent-primary))] flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Prochat</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-accent/50">
              Sign in
            </button>
          </Link>
          <Link to="/register">
            <button className="text-sm font-semibold px-4 py-2 rounded-lg bg-[hsl(var(--accent-primary))] text-white hover:opacity-90 transition-opacity">
              Get started
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--accent-primary)/0.1)] border border-[hsl(var(--accent-primary)/0.2)] text-[hsl(var(--accent-primary))] text-xs font-medium mb-8">
          <Zap className="w-3 h-3" />
          Real-time messaging, zero delay
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6 max-w-3xl leading-[1.05]">
          Chat that feels{' '}
          <span className="text-[hsl(var(--accent-primary))]">instant.</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed px-2">
          Public rooms, private messages, real-time updates. Built for speed and simplicity.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-5 w-full sm:w-auto px-4 sm:px-0">
          <Link to="/register" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[hsl(var(--accent-primary))] text-white font-semibold hover:opacity-90 transition-all shadow-lg shadow-[hsl(var(--accent-primary)/0.25)] text-sm">
              Create free account
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-border font-semibold hover:bg-accent/50 transition-all text-sm">
              Sign in
            </button>
          </Link>
        </div>

        <button
          onClick={handleGuestLogin}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Globe className="w-4 h-4" />
          Continue as guest — no account needed
        </button>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-16 max-w-3xl w-full px-2 sm:px-0">
          {[
            { icon: Zap, title: 'Instant delivery', desc: 'Messages appear in real-time via Supabase Realtime' },
            { icon: Shield, title: 'Private chats', desc: 'One-on-one conversations with row-level security' },
            { icon: Users, title: 'Public rooms', desc: 'Join open channels and chat with everyone' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-2xl border border-border/60 bg-card text-left hover:border-[hsl(var(--accent-primary)/0.4)] transition-colors">
              <div className="w-9 h-9 rounded-lg bg-[hsl(var(--accent-primary)/0.1)] flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
              </div>
              <p className="font-semibold text-sm mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border/50">
        Built by <span className="font-medium text-foreground">Touseef Ur Rehman</span> · Pakistan 🇵🇰
      </footer>
    </div>
  );
};

export default Index;
