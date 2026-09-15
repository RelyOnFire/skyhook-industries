import { simulateGeometry } from '../../simulation/designer.js';
self.onmessage = (event: MessageEvent) => {
  const { id, design } = event.data;
  try {
    const result = simulateGeometry(design, { progress: fraction => self.postMessage({ id, fraction }) });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
