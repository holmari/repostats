import './DownloadProgressBar.css';

import React, {useEffect, useRef, useState} from 'react';
import {DownloadPhase, PhaseProgress} from 'types/types';

interface ProgressRingProps {
  progress: number; // 0 to 1
  size: number;
  strokeWidth: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({progress, size, strokeWidth}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;
  const separatorRadius = radius - strokeWidth / 2 + 0.5;

  return (
    <svg
      className="DownloadProgressBar__progress-ring"
      width={size}
      height={size}
    >
      <circle
        className="DownloadProgressBar__progress-ring-bg"
        strokeWidth={strokeWidth}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className="DownloadProgressBar__progress-ring-fill"
        strokeWidth={strokeWidth}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{
          strokeDasharray: circumference,
          strokeDashoffset,
        }}
      />
      <circle
        className="DownloadProgressBar__progress-ring-separator"
        strokeWidth={1}
        fill="transparent"
        r={separatorRadius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  );
};

interface Step {
  phase: DownloadPhase;
  label: string;
  isEndpoint: boolean;
}

const STEPS: Step[] = [
  {phase: 'start', label: 'Start', isEndpoint: true},
  {phase: 'pulls', label: 'Pull Requests', isEndpoint: false},
  {phase: 'comments', label: 'Comments', isEndpoint: false},
  {phase: 'teams', label: 'Teams', isEndpoint: false},
  {phase: 'reviews', label: 'Reviews', isEndpoint: false},
  {phase: 'commits', label: 'Commits', isEndpoint: false},
  {phase: 'finish', label: 'Finish', isEndpoint: true},
];

function getStepIndex(phase: DownloadPhase): number {
  return STEPS.findIndex((step) => step.phase === phase);
}

interface Props {
  currentPhase: DownloadPhase;
  phaseProgress?: PhaseProgress | null;
  hasError?: boolean;
}

const DownloadProgressBar: React.FC<Props> = ({currentPhase, phaseProgress, hasError = false}) => {
  const currentIndex = getStepIndex(currentPhase ?? 'start');
  const progressPercent = phaseProgress?.total
    ? Math.min(1, phaseProgress.current / phaseProgress.total)
    : 0;
  const prevIndexRef = useRef(currentIndex);
  const [animatingSteps, setAnimatingSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prevIndex = prevIndexRef.current;
    if (currentIndex > prevIndex) {
      // Mark all steps between prevIndex and currentIndex as newly completed
      const newlyCompleted = new Set<number>();
      for (let i = prevIndex; i < currentIndex; i++) {
        newlyCompleted.add(i);
      }
      setAnimatingSteps(newlyCompleted);

      // Clear animation class after animation completes
      const timer = setTimeout(() => {
        setAnimatingSteps(new Set());
      }, 500);

      prevIndexRef.current = currentIndex;
      return () => clearTimeout(timer);
    }
    prevIndexRef.current = currentIndex;
    return undefined;
  }, [currentIndex]);

  return (
    <div className="DownloadProgressBar">
      <div className="DownloadProgressBar__track">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          const isJustCompleted = animatingSteps.has(index);

          const isError = hasError && isCurrent;

          let stepClass = 'DownloadProgressBar__step';
          if (step.isEndpoint) {
            stepClass += ' DownloadProgressBar__step--endpoint';
          }
          if (isCompleted) {
            stepClass += ' DownloadProgressBar__step--completed';
            if (isJustCompleted) {
              stepClass += ' DownloadProgressBar__step--just-completed';
            }
          } else if (isError) {
            stepClass += ' DownloadProgressBar__step--error';
          } else if (isCurrent) {
            stepClass += ' DownloadProgressBar__step--current';
          } else if (isPending) {
            stepClass += ' DownloadProgressBar__step--pending';
          }

          // Connector should be completed when we've reached or passed this step
          const connectorCompleted = index <= currentIndex;

          return (
            <React.Fragment key={step.phase}>
              {index > 0 && (
                <div
                  className={`DownloadProgressBar__connector ${
                    connectorCompleted ? 'DownloadProgressBar__connector--completed' : ''
                  }`}
                />
              )}
              <div className={stepClass}>
                <div className="DownloadProgressBar__step-indicator">
                  {isCompleted && <span className="DownloadProgressBar__checkmark">&#10003;</span>}
                  {isError && <span className="DownloadProgressBar__error-x">&#10005;</span>}
                  {isCurrent && !isError && !step.isEndpoint && (
                    <>
                      <span className="DownloadProgressBar__pulse" />
                      {phaseProgress?.total != null && (
                        <ProgressRing progress={progressPercent} size={44} strokeWidth={5} />
                      )}
                    </>
                  )}
                </div>
                <div className="DownloadProgressBar__step-label">{step.label}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
