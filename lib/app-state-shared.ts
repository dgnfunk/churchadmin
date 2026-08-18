import type { Church, ServicePlan, SlideTheme, ThemeSettings } from "@/lib/domain";

export interface AppState {
  church: Church;
  theme: ThemeSettings;
  servicePlans: ServicePlan[];
  slideThemes: SlideTheme[];
  activeServicePlanId: string;
}
