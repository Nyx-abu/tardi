export interface TrajectoryStep {
  type: 'Thought' | 'Action' | 'Observation';
  content: string;
}

/**
 * The Adapter Layer (Ingestion Engine)
 * Parses messy stdout from various agent frameworks and standardizes it into a Trajectory Graph.
 * Supports multi-line blocks correctly.
 */
export function parseStdoutTrajectory(stdout: string): TrajectoryStep[] {
  const steps: TrajectoryStep[] = [];
  
  // Regex to match markers like "Thought:", "Action:", "Observation:", "ToolCall:", "Result:"
  const markerRegex = /^(Thought|Action|Observation|ToolCall|Result):\s*/gm;
  
  let match;
  let lastIndex = 0;
  let currentType: string | null = null;
  
  while ((match = markerRegex.exec(stdout)) !== null) {
    if (currentType) {
      // Extract the content from the end of the previous marker to the start of this one
      const content = stdout.substring(lastIndex, match.index).trim();
      steps.push(normalizeStep(currentType, content));
    }
    
    currentType = match[1];
    lastIndex = markerRegex.lastIndex;
  }
  
  // Push the final step if it exists
  if (currentType) {
    const content = stdout.substring(lastIndex).trim();
    steps.push(normalizeStep(currentType, content));
  }
  
  return steps;
}

function normalizeStep(rawType: string, content: string): TrajectoryStep {
  if (rawType === 'ToolCall') return { type: 'Action', content };
  if (rawType === 'Result') return { type: 'Observation', content };
  return { type: rawType as 'Thought' | 'Action' | 'Observation', content };
}
