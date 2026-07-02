import type { ComponentType } from "react";
import type { StepProps } from "@/components/onboarding/training/types";
import type { TrainingField } from "@/lib/onboarding/training/answers";
import Step01 from "@/components/onboarding/training/steps/Step01";
import Step02 from "@/components/onboarding/training/steps/Step02";
import Step03 from "@/components/onboarding/training/steps/Step03";
import Step04 from "@/components/onboarding/training/steps/Step04";
import Step05 from "@/components/onboarding/training/steps/Step05";
import Step06 from "@/components/onboarding/training/steps/Step06";
import Step07 from "@/components/onboarding/training/steps/Step07";
import Step08 from "@/components/onboarding/training/steps/Step08";
import Step09 from "@/components/onboarding/training/steps/Step09";
import Step10 from "@/components/onboarding/training/steps/Step10";
import Step11 from "@/components/onboarding/training/steps/Step11";
import Step12 from "@/components/onboarding/training/steps/Step12";
import Step13 from "@/components/onboarding/training/steps/Step13";

export type ContinueVariant = "link" | "pill";

export interface WizardStepConfig {
  /** Small-caps section, e.g. "WHERE YOU ARE". */
  section: string;
  /** Newsreader-italic question heading. */
  question: string;
  /** Plain subtitle rendered by the shell (steps with interactive subtitles render their own). */
  subtitle?: string;
  /** Profile column this step writes. */
  field: TrainingField;
  continueVariant: ContinueVariant;
  Component: ComponentType<StepProps>;
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  {
    section: "WHERE YOU ARE",
    question: "How long have you been lifting consistently?",
    field: "training_experience",
    continueVariant: "link",
    Component: Step01,
  },
  {
    section: "WHERE YOU ARE",
    question: "How confident are you with the big barbell lifts?",
    field: "barbell_confidence",
    continueVariant: "link",
    Component: Step02,
  },
  {
    section: "WHERE YOU ARE",
    question: "How's recovery been lately, sleep, stress, all of it?",
    field: "recovery_level",
    continueVariant: "link",
    Component: Step03,
  },
  {
    section: "WHAT YOU WANT",
    question: "What's the headline goal?",
    field: "headline_goal",
    continueVariant: "link",
    Component: Step04,
  },
  {
    section: "WHAT YOU WANT",
    question: "Any body parts to bias toward?",
    subtitle: "Tap the body, pick up to 2, or choose balanced if it's all even.",
    field: "body_bias",
    continueVariant: "pill",
    Component: Step05,
  },
  {
    section: "HOW YOU TRAIN",
    question: "How do you actually like to train?",
    field: "preferred_split",
    continueVariant: "link",
    Component: Step06,
  },
  {
    section: "HOW YOU TRAIN",
    question: "When given a choice, what do you reach for first?",
    field: "equipment_preference",
    continueVariant: "link",
    Component: Step07,
  },
  {
    section: "HOW YOU TRAIN",
    question: "When you finish a hard set, where do you usually stop?",
    field: "rpe_style",
    continueVariant: "link",
    Component: Step08,
  },
  {
    section: "HOW YOU TRAIN",
    question: "How many days a week, honestly?",
    field: "training_days_per_week",
    continueVariant: "pill",
    Component: Step09,
  },
  {
    section: "HOW YOU TRAIN",
    question: "How long is each session, realistically?",
    field: "session_duration_min",
    continueVariant: "pill",
    Component: Step10,
  },
  {
    section: "HOW YOU TRAIN",
    question: "What do you have access to?",
    field: "equipment_access",
    continueVariant: "link",
    Component: Step11,
  },
  {
    section: "YOUR BODY",
    question: "Anything your body needs you to avoid?",
    subtitle: "Pick any that apply, or nothing if you're good to lift everything.",
    field: "movement_limitations",
    continueVariant: "pill",
    Component: Step12,
  },
  {
    section: "YOUR BODY",
    question: "What fills your week outside lifting?",
    field: "lifestyle_activity",
    continueVariant: "link",
    Component: Step13,
  },
];
