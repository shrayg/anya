"use client";

import {
  AnimatePresence,
  motion,
  type Variants,
} from "motion/react";
import React, {
  Children,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type JSX,
  type ReactNode,
} from "react";

import "./stepper.css";

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  onSkip?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  skipButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  skipButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: RenderStepIndicatorProps) => ReactNode;
}

interface RenderStepIndicatorProps {
  step: number;
  currentStep: number;
  onStepClick: (clicked: number) => void;
}

const ACCENT = "#c3d3e6";
const ACCENT_MUTED = "#222830";
const ACCENT_TEXT = "#a8b4c4";

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  onSkip,
  stepCircleContainerClassName = "",
  stepContainerClassName = "",
  contentClassName = "",
  footerClassName = "",
  backButtonProps = {},
  nextButtonProps = {},
  skipButtonProps = {},
  backButtonText = "Back",
  nextButtonText = "Continue",
  completeButtonText = "Complete",
  skipButtonText = "Skip",
  disableStepIndicators = false,
  renderStepIndicator,
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div className="anya-stepper-outer" {...rest}>
      <div
        className={`anya-stepper-card ${stepCircleContainerClassName}`}
      >
        <div className={`anya-stepper-indicators ${stepContainerClassName}`}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;

            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: (clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    },
                  })
                ) : (
                  <StepIndicator
                    currentStep={currentStep}
                    disableStepIndicators={disableStepIndicators}
                    step={stepNumber}
                    onClickStep={(clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }}
                  />
                )}
                {isNotLastStep ? (
                  <StepConnector isComplete={currentStep > stepNumber} />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>

        <StepContentWrapper
          className={`anya-stepper-content ${contentClassName}`}
          currentStep={currentStep}
          direction={direction}
          isCompleted={isCompleted}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted ? (
          <div className={`anya-stepper-footer ${footerClassName}`}>
            <div className="anya-stepper-footer-row">
              {onSkip ? (
                <button
                  className="anya-stepper-skip"
                  type="button"
                  onClick={onSkip}
                  {...skipButtonProps}
                >
                  {skipButtonText}
                </button>
              ) : (
                <span />
              )}
              <div
                className={`anya-stepper-nav ${currentStep !== 1 ? "spread" : "end"}`}
              >
                {currentStep !== 1 ? (
                  <button
                    className="anya-stepper-back"
                    type="button"
                    onClick={handleBack}
                    {...backButtonProps}
                  >
                    {backButtonText}
                  </button>
                ) : null}
                <button
                  className="anya-stepper-next"
                  type="button"
                  onClick={isLastStep ? handleComplete : handleNext}
                  {...nextButtonProps}
                >
                  {isLastStep ? completeButtonText : nextButtonText}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface StepContentWrapperProps {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className,
}: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);

  return (
    <motion.div
      animate={{ height: isCompleted ? 0 : parentHeight }}
      className={className}
      style={{ position: "relative", overflow: "hidden" }}
      transition={{ type: "spring", duration: 0.4 }}
    >
      <AnimatePresence custom={direction} initial={false} mode="sync">
        {!isCompleted ? (
          <SlideTransition
            key={currentStep}
            direction={direction}
            onHeightReady={(h) => setParentHeight(h)}
          >
            {children}
          </SlideTransition>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

interface SlideTransitionProps {
  children: ReactNode;
  direction: number;
  onHeightReady: (h: number) => void;
}

function SlideTransition({
  children,
  direction,
  onHeightReady,
}: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      onHeightReady(containerRef.current.offsetHeight);
    }
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      animate="center"
      custom={direction}
      exit="exit"
      initial="enter"
      style={{ position: "absolute", left: 0, right: 0, top: 0 }}
      transition={{ duration: 0.4 }}
      variants={stepVariants}
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? "-100%" : "100%",
    opacity: 0,
  }),
  center: {
    x: "0%",
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? "50%" : "-50%",
    opacity: 0,
  }),
};

interface StepProps {
  children: ReactNode;
}

export function Step({ children }: StepProps): JSX.Element {
  return <div className="anya-stepper-step">{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  onClickStep: (step: number) => void;
  disableStepIndicators?: boolean;
}

function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators,
}: StepIndicatorProps) {
  const status =
    currentStep === step ? "active" : currentStep < step ? "inactive" : "complete";

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) {
      onClickStep(step);
    }
  };

  return (
    <motion.div
      animate={status}
      className="anya-stepper-indicator"
      initial={false}
      style={
        disableStepIndicators ? { pointerEvents: "none", opacity: 0.5 } : undefined
      }
      onClick={handleClick}
    >
      <motion.div
        className="anya-stepper-indicator-inner"
        transition={{ duration: 0.3 }}
        variants={{
          inactive: {
            scale: 1,
            backgroundColor: ACCENT_MUTED,
            color: ACCENT_TEXT,
          },
          active: {
            scale: 1,
            backgroundColor: ACCENT,
            color: ACCENT,
          },
          complete: {
            scale: 1,
            backgroundColor: ACCENT,
            color: "#6b8aad",
          },
        }}
      >
        {status === "complete" ? (
          <CheckIcon className="anya-stepper-check" />
        ) : status === "active" ? (
          <div className="anya-stepper-dot" />
        ) : (
          <span className="anya-stepper-number">{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

interface StepConnectorProps {
  isComplete: boolean;
}

function StepConnector({ isComplete }: StepConnectorProps) {
  const lineVariants: Variants = {
    incomplete: { width: 0, backgroundColor: "transparent" },
    complete: { width: "100%", backgroundColor: ACCENT },
  };

  return (
    <div className="anya-stepper-connector">
      <motion.div
        animate={isComplete ? "complete" : "incomplete"}
        className="anya-stepper-connector-inner"
        initial={false}
        transition={{ duration: 0.4 }}
        variants={lineVariants}
      />
    </div>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      {...props}
    >
      <motion.path
        animate={{ pathLength: 1 }}
        d="M5 13l4 4L19 7"
        initial={{ pathLength: 0 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        transition={{
          delay: 0.1,
          type: "tween",
          ease: "easeOut",
          duration: 0.3,
        }}
      />
    </svg>
  );
}
