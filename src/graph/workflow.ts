import { StateGraph, END } from '@langchain/langgraph';
import { GraphState, type GraphStateType } from './state.js';
import { plannerAgent } from '../agents/planner.js';
import { generatorAgent } from '../agents/generator.js';
import { runnerAgent } from '../agents/runner.js';
import { healerAgent } from '../agents/healer.js';

function routeAfterRunner(state: GraphStateType): string {
  switch (state.phase) {
    case 'healing':
      return 'healer';
    case 'success':
      return 'end';
    case 'running':
      // Retry case (navigation timeout etc.)
      return 'runner';
    case 'failed':
      return 'end';
    default:
      return 'end';
  }
}

function routeAfterHealer(state: GraphStateType): string {
  switch (state.phase) {
    case 'running':
      return 'runner';
    case 'failed':
      return 'end';
    default:
      return 'end';
  }
}

export function buildWorkflow() {
  const workflow = new StateGraph(GraphState)
    .addNode('planner', plannerAgent)
    .addNode('generator', generatorAgent)
    .addNode('runner', runnerAgent)
    .addNode('healer', healerAgent)
    .addEdge('__start__', 'planner')
    .addEdge('planner', 'generator')
    .addEdge('generator', 'runner')
    .addConditionalEdges('runner', routeAfterRunner, {
      healer: 'healer',
      runner: 'runner',
      end: END,
    })
    .addConditionalEdges('healer', routeAfterHealer, {
      runner: 'runner',
      end: END,
    });

  return workflow.compile();
}
