"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { GlobalHeader } from "@/components/layout/global-header";
import { OneSignalProvider } from "@/components/providers/onesignal-provider";

type GuardProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type GuardState = {
  hasError: boolean;
};

class ClientGuard extends Component<GuardProps, GuardState> {
  state: GuardState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Client guard caught runtime error", error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-50 border-b border-gold/20 bg-black/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
        <a href="/" className="font-display text-lg text-softGold">
          Diamond Studio by Nicole
        </a>
      </div>
    </header>
  );
}

export function RuntimeGuards() {
  return (
    <>
      <ClientGuard fallback={null}>
        <OneSignalProvider />
      </ClientGuard>
      <ClientGuard fallback={<HeaderFallback />}>
        <GlobalHeader />
      </ClientGuard>
    </>
  );
}

