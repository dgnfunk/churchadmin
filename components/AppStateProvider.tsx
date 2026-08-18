"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Church, ServicePlan, SlideTheme, ThemeSettings } from "@/lib/domain";
import type { AppState } from "@/lib/app-state-shared";
import { themeToCssVariables } from "@/lib/theme";

interface AppStateContextValue extends AppState {
  activeServicePlan: ServicePlan;
  updateChurch: (church: Church) => void;
  updateTheme: (theme: ThemeSettings) => void;
  resetAppState: () => void;
  setActiveServicePlanId: (id: string) => void;
  updateServicePlan: (plan: ServicePlan) => void;
  addServicePlan: (plan: ServicePlan) => void;
  removeServicePlan: (id: string) => void;
  replaceSlideThemes: (themes: SlideTheme[]) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function applyThemeVariables(theme: ThemeSettings) {
  const root = document.documentElement;
  Object.entries(themeToCssVariables(theme)).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function AppStateProvider({ children, initialState }: { children: ReactNode; initialState: AppState }) {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    applyThemeVariables(state.theme);
  }, [state.theme]);

  const updateChurch = useCallback((nextChurch: Church) => {
    setState((current) => ({ ...current, church: nextChurch }));
  }, []);

  const updateTheme = useCallback((nextTheme: ThemeSettings) => {
    setState((current) => ({ ...current, theme: nextTheme }));
  }, []);

  const resetAppState = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  const setActiveServicePlanId = useCallback((id: string) => {
    setState((current) => ({ ...current, activeServicePlanId: id }));
  }, []);

  const updateServicePlan = useCallback((plan: ServicePlan) => {
    setState((current) => ({
      ...current,
      servicePlans: current.servicePlans.map((candidate) => (candidate.id === plan.id ? plan : candidate))
    }));
  }, []);

  const addServicePlan = useCallback((plan: ServicePlan) => {
    setState((current) => ({
      ...current,
      servicePlans: [...current.servicePlans, plan],
      activeServicePlanId: plan.id
    }));
  }, []);

  const removeServicePlan = useCallback((id: string) => {
    setState((current) => {
      const servicePlans = current.servicePlans.filter((plan) => plan.id !== id);
      return {
        ...current,
        servicePlans,
        activeServicePlanId: current.activeServicePlanId === id ? servicePlans[0]?.id ?? "" : current.activeServicePlanId
      };
    });
  }, []);

  const replaceSlideThemes = useCallback((slideThemes: SlideTheme[]) => {
    setState((current) => ({ ...current, slideThemes }));
  }, []);

  const value = useMemo<AppStateContextValue>(() => {
    const activeServicePlan =
      state.servicePlans.find((plan) => plan.id === state.activeServicePlanId) ?? state.servicePlans[0];

    return {
      ...state,
      activeServicePlan,
      updateChurch,
      updateTheme,
      resetAppState,
      setActiveServicePlanId,
      updateServicePlan,
      addServicePlan
      ,removeServicePlan
      ,replaceSlideThemes
    };
  }, [addServicePlan, removeServicePlan, replaceSlideThemes, resetAppState, setActiveServicePlanId, state, updateChurch, updateServicePlan, updateTheme]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return value;
}
