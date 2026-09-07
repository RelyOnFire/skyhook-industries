import { ACTIVE_ARCHITECTURE, MODEL, validate, type Design } from './engine.js';

export interface ImportedDesign { design: Design; needsConfirmation: boolean; explanation: string }

/** Parse data, never code. Old physics/configuration semantics require consent. */
export function readDesign(text: string): ImportedDesign {
  if (text.length > 16000) throw Error('Design file exceeds 16 KB.');
  const value: unknown = JSON.parse(text);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const d = value as Record<string, unknown>;
    if (d.schema === 2 && d.model === 'D1p-0.2.0') {
      return { design: validate({ ...d, model: MODEL }), needsConfirmation: true, explanation:
        'This design used model 0.2, which inserted Payload 2 at the tip. Model 0.3 predicts an ideal second approach, propagates it independently and checks the meeting before attachment. Update to run the new model; the previous result is not being reused.' };
    }
    if (d.schema === 1 && d.model === 'D1p-0.1.0') {
      const coast = d.recovery === 'none';
      const design = validate({ ...d, schema: 2, model: MODEL,
        architecture: ACTIVE_ARCHITECTURE, ...(coast ? { fuelT: 0 } : {}) });
      return { design, needsConfirmation: true, explanation: coast
        ? 'This design used the first model, where Coast still carried unused propellant. Updating removes that fuel mass and recalculates the mission. The result may change.'
        : 'This design used the first model. Updating adds an explicit single-stage architecture and the new input range. A fresh calculation will replace the old result.' };
    }
  }
  return { design: validate(value), needsConfirmation: false, explanation: '' };
}

export function designFragment(design: Design): string {
  return `#d=${encodeURIComponent(JSON.stringify(validate(design)))}`;
}
